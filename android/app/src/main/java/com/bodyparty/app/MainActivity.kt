package com.bodyparty.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Hosts the Body Party web game (assets/index.html) in a full-screen WebView.
 * The page is served from https://appassets.androidplatform.net so the camera API
 * gets a secure origin, and two JavaScript bridges are added:
 *  - AndroidBilling: Google Play purchases (one-time Party Pack + monthly Plus)
 *  - AndroidApp: saving Nonsense Cam videos to the gallery
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var billing: BillingBridge
    private var pendingPermission: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web = WebView(this)
        setContentView(web)
        goFullscreen()

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
        }
        web.setBackgroundColor(0xFF140A2E.toInt())

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == ASSET_HOST) return false
                // mailto:, Google Play subscription page, other websites -> open outside the game
                openExternal(url)
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (request.origin.host != ASSET_HOST) { request.deny(); return }
                val needed = neededPermissions(request.resources)
                if (needed.isEmpty()) {
                    request.grant(request.resources)
                } else {
                    pendingPermission = request
                    requestPermissions(needed.toTypedArray(), REQ_MEDIA)
                }
            }
        }

        billing = BillingBridge(this, web)
        web.addJavascriptInterface(billing, "AndroidBilling")
        web.addJavascriptInterface(AppBridge(this), "AndroidApp")
        billing.connect()

        web.loadUrl("https://$ASSET_HOST/assets/index.html")
    }

    private fun neededPermissions(resources: Array<String>): List<String> {
        val out = mutableListOf<String>()
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in resources && !granted(Manifest.permission.CAMERA)) out += Manifest.permission.CAMERA
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in resources && !granted(Manifest.permission.RECORD_AUDIO)) out += Manifest.permission.RECORD_AUDIO
        return out
    }

    private fun granted(p: String) = checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_MEDIA) return
        val req = pendingPermission ?: return
        pendingPermission = null
        val ok = req.resources.filter {
            (it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && granted(Manifest.permission.CAMERA)) ||
                (it == PermissionRequest.RESOURCE_AUDIO_CAPTURE && granted(Manifest.permission.RECORD_AUDIO))
        }
        if (ok.isEmpty()) req.deny() else req.grant(ok.toTypedArray())
    }

    private fun openExternal(url: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
        }
    }

    private fun goFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goFullscreen()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        billing.refresh()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    // Phone back button and TV remote back: let the game go back a screen first.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'y' : 'n'") { r ->
            if (r?.contains("y") != true) {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    override fun onDestroy() {
        billing.end()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        private const val REQ_MEDIA = 42
    }
}
