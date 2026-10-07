package se.chargamo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.text.DateFormat
import java.util.Date

/**
 * Always-on watcher.
 *
 * - Charger connected → wakes the AI (opens [MainActivity]).
 * - Facebook or TikTok opened while charging → charging stops and stays off for an hour.
 */
class ChargeGuardService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var lastEventQuery = 0L
    private var lastReapply = 0L
    private var lastNotifiedLocked: Boolean? = null

    private val powerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_POWER_CONNECTED -> onPowerConnected()
                Intent.ACTION_POWER_DISCONNECTED -> lastEventQuery = 0L
            }
        }
    }

    private val tick = object : Runnable {
        override fun run() {
            try {
                check()
            } catch (e: Exception) {
                Log.w(TAG, "check failed", e)
            }
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels()
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildStatusNotification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            } else {
                0
            },
        )
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
        }
        ContextCompat.registerReceiver(this, powerReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        handler.post(tick)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        unregisterReceiver(powerReceiver)
        super.onDestroy()
    }

    private fun onPowerConnected() {
        lastEventQuery = 0L
        if (Prefs.isLockedOut(this)) {
            ChargeControl.setChargingAsync(false)
            lastReapply = System.currentTimeMillis()
        } else {
            launchAi()
        }
    }

    private fun check() {
        val now = System.currentTimeMillis()
        val plugged = isPlugged()

        if (Prefs.isLockedOut(this)) {
            // Some kernels reset the control file on re-plug, so keep it switched off.
            if (plugged && now - lastReapply > REAPPLY_MS) {
                ChargeControl.setChargingAsync(false)
                lastReapply = now
            }
        } else {
            if (Prefs.isChargeBlocked(this)) {
                Prefs.setChargeBlocked(this, false)
                ChargeControl.setChargingAsync(true)
                notifyLockoutChanged()
                if (plugged) launchAi()
            }
            if (plugged) {
                checkForbiddenApps(now)
            } else {
                lastEventQuery = 0L
            }
        }
        refreshStatusNotification()
    }

    private fun checkForbiddenApps(now: Long) {
        if (!Perms.hasUsageAccess(this)) return
        val usm = getSystemService(UsageStatsManager::class.java)
        val firstCheck = lastEventQuery == 0L
        // On the first check after plugging in, also catch a forbidden app that is already open.
        val from = if (firstCheck) now - FIRST_LOOKBACK_MS else lastEventQuery
        val events = usm.queryEvents(from, now)
        lastEventQuery = now

        val event = UsageEvents.Event()
        var latestForeground: String? = null
        var forbiddenOpened: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == EVENT_ACTIVITY_RESUMED) {
                latestForeground = event.packageName
                if (isForbidden(event.packageName)) forbiddenOpened = event.packageName
            }
        }

        val hit = if (firstCheck) {
            latestForeground?.takeIf {
                isForbidden(it) && getSystemService(PowerManager::class.java).isInteractive
            }
        } else {
            forbiddenOpened
        }
        if (hit != null) startLockout(hit)
    }

    private fun startLockout(pkg: String) {
        Log.i(TAG, "$pkg opened while charging, blocking charging for an hour")
        Prefs.startLockout(this)
        ChargeControl.setChargingAsync(false)
        lastReapply = System.currentTimeMillis()
        notifyLockoutChanged()
        refreshStatusNotification()
    }

    private fun notifyLockoutChanged() {
        sendBroadcast(Intent(Prefs.ACTION_LOCKOUT_CHANGED).setPackage(packageName))
    }

    private fun isPlugged(): Boolean {
        val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        return (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
    }

    private fun launchAi() {
        val intent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (Perms.canDrawOverlays(this)) {
            try {
                startActivity(intent)
                return
            } catch (e: Exception) {
                Log.w(TAG, "direct launch failed", e)
            }
        }
        // Without "display over other apps" Android only lets us wake up through a full-screen notification.
        val pi = PendingIntent.getActivity(
            this, 1, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(this, CHANNEL_WAKE)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(getString(R.string.app_name))
            .setContentText("Laddar – AI:n vaknar")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pi, true)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setTimeoutAfter(20_000)
            .build()
        try {
            getSystemService(NotificationManager::class.java).notify(WAKE_NOTIF_ID, n)
        } catch (e: SecurityException) {
            Log.w(TAG, "cannot post wake notification", e)
        }
    }

    private fun refreshStatusNotification() {
        val locked = Prefs.isLockedOut(this)
        if (locked == lastNotifiedLocked) return
        lastNotifiedLocked = locked
        try {
            getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildStatusNotification())
        } catch (e: SecurityException) {
            Log.w(TAG, "cannot update notification", e)
        }
    }

    private fun buildStatusNotification(): Notification {
        val text = if (Prefs.isLockedOut(this)) {
            val until = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(Prefs.lockUntil(this)))
            "Facebook/TikTok öppnades – ingen laddning förrän $until"
        } else {
            "Väntar på laddaren"
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_STATUS)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(open)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    private fun createChannels() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_STATUS, "Chargamo vakt", NotificationManager.IMPORTANCE_MIN),
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_WAKE, "Chargamo vaknar", NotificationManager.IMPORTANCE_HIGH),
        )
    }

    companion object {
        private const val TAG = "ChargeGuard"
        private const val CHANNEL_STATUS = "status"
        private const val CHANNEL_WAKE = "wake"
        private const val NOTIF_ID = 1
        const val WAKE_NOTIF_ID = 2
        private const val TICK_MS = 1000L
        private const val REAPPLY_MS = 20_000L
        private const val FIRST_LOOKBACK_MS = 30 * 60 * 1000L

        // UsageEvents.Event.ACTIVITY_RESUMED (MOVE_TO_FOREGROUND before API 29).
        private const val EVENT_ACTIVITY_RESUMED = 1

        private val FORBIDDEN_PACKAGES = setOf(
            "com.facebook.katana",
            "com.facebook.lite",
        )
        private val FORBIDDEN_PREFIXES = listOf(
            "com.zhiliaoapp.musically", // TikTok
            "com.ss.android.ugc.", // TikTok (trill), Douyin
            "com.tiktok.",
        )

        fun isForbidden(pkg: String): Boolean =
            pkg in FORBIDDEN_PACKAGES || FORBIDDEN_PREFIXES.any { pkg.startsWith(it) }

        fun start(c: Context) {
            try {
                ContextCompat.startForegroundService(c, Intent(c, ChargeGuardService::class.java))
            } catch (e: Exception) {
                Log.w(TAG, "cannot start service", e)
            }
        }
    }
}
