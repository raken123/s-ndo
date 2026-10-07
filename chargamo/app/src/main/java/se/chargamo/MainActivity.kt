package se.chargamo

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * The only screen: two square blue eyes on black.
 *
 * While the phone charges (and is not locked out) the Gemini Live AI is awake,
 * watching through the camera and listening through the microphone.
 * A slow 180° turn dims the screen and closes the eyes; another one wakes it again.
 */
class MainActivity : ComponentActivity() {

    private lateinit var eyes: EyesView
    private lateinit var flip: SlowFlipDetector
    private var live: GeminiLive? = null
    private var camera: CameraFeeder? = null

    private var isResumedNow = false
    private var plugged = false
    private var sleeping = false

    // One-time walk through the system settings screens Chargamo depends on.
    private var setupStep = SETUP_DONE
    private var awaitingSettings = false

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            setupStep = SETUP_USAGE
            continueSetup()
            updateAi()
        }

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
            updateAi()
        }
    }

    private val lockoutReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) = updateAi()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        eyes = EyesView(this)
        setContentView(eyes)
        hideSystemBars()

        flip = SlowFlipDetector(this) { onSlowFlip() }
        ChargeGuardService.start(this)
        handleIntent(intent)

        if (savedInstanceState == null) {
            setupStep = SETUP_RUNTIME
            continueSetup()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
        updateAi()
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_KEY_SAVED, false) == true) eyes.blinkTwice()
    }

    override fun onResume() {
        super.onResume()
        isResumedNow = true
        hideSystemBars()
        getSystemService(NotificationManager::class.java).cancel(ChargeGuardService.WAKE_NOTIF_ID)

        val battery = ContextCompat.registerReceiver(
            this, batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        plugged = (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
        ContextCompat.registerReceiver(
            this, lockoutReceiver, IntentFilter(Prefs.ACTION_LOCKOUT_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        flip.start()

        if (awaitingSettings) {
            awaitingSettings = false
            continueSetup()
        }
        updateAi()
    }

    override fun onPause() {
        isResumedNow = false
        unregisterReceiver(batteryReceiver)
        unregisterReceiver(lockoutReceiver)
        flip.stop()
        updateAi()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun onSlowFlip() {
        sleeping = !sleeping
        window.attributes = window.attributes.apply {
            screenBrightness = if (sleeping) DIM_BRIGHTNESS else WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
        }
        eyes.closed = sleeping
        updateAi()
    }

    /** Starts or stops the AI so that it runs exactly while it should. */
    private fun updateAi() {
        val wanted = isResumedNow && plugged && !sleeping &&
            !Prefs.isLockedOut(this) && Perms.hasCameraAndMic(this)
        val key = Prefs.apiKey(this)
        eyes.searching = wanted && key == null
        if (wanted && key != null) {
            if (live == null) startAi(key)
        } else {
            stopAi()
        }
    }

    private fun startAi(key: String) {
        val session = GeminiLive(this, key, BuildConfig.GEMINI_MODEL) { level -> eyes.voiceLevel = level }
        live = session
        session.start()
        camera = CameraFeeder(this) { jpeg -> session.sendVideo(jpeg) }.also { it.start() }
    }

    private fun stopAi() {
        camera?.stop()
        camera = null
        live?.stop()
        live = null
        eyes.voiceLevel = 0f
    }

    private fun continueSetup() {
        while (setupStep != SETUP_DONE) {
            val step = setupStep
            setupStep++
            when (step) {
                SETUP_RUNTIME -> {
                    val missing = runtimePermissions().filterNot { Perms.granted(this, it) }
                    if (missing.isNotEmpty()) {
                        permissionLauncher.launch(missing.toTypedArray())
                        return
                    }
                }
                SETUP_USAGE -> if (!Perms.hasUsageAccess(this)) {
                    openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                    return
                }
                SETUP_OVERLAY -> if (!Perms.canDrawOverlays(this)) {
                    openSettings(
                        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")),
                    )
                    return
                }
                SETUP_BATTERY -> if (!Perms.ignoresBatteryOptimizations(this)) {
                    @SuppressLint("BatteryLife")
                    val i = Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:$packageName"),
                    )
                    openSettings(i)
                    return
                }
                else -> setupStep = SETUP_DONE
            }
        }
    }

    private fun openSettings(intent: Intent) {
        try {
            awaitingSettings = true
            startActivity(intent)
        } catch (e: Exception) {
            awaitingSettings = false
            continueSetup()
        }
    }

    private fun runtimePermissions(): List<String> = buildList {
        add(Manifest.permission.CAMERA)
        add(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    companion object {
        const val EXTRA_KEY_SAVED = "key_saved"
        private const val DIM_BRIGHTNESS = 0.02f

        private const val SETUP_RUNTIME = 0
        private const val SETUP_USAGE = 1
        private const val SETUP_OVERLAY = 2
        private const val SETUP_BATTERY = 3
        private const val SETUP_DONE = 4
    }
}
