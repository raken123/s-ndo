package com.gmfy.hub;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** gmfy Hub for Android: a full-screen WebView hosting the bundled hub client. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#0b0f1a"));
        getWindow().setNavigationBarColor(Color.parseColor("#111827"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b0f1a"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage keeps the session token and server URL
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://")) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/www/index.html");
        setContentView(web);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        // Let the web app consume back (leave game, close modal, go back a view); otherwise background the app.
        web.evaluateJavascript("(function(){return window.hubBack ? String(window.hubBack()) : 'false'})()", value -> {
            if (!"\"true\"".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onDestroy() { web.destroy(); super.onDestroy(); }

    /** Exposed to the page as window.AndroidBridge. */
    public class Bridge {
        @JavascriptInterface
        public String version() { return "1.0.0 (Android " + Build.VERSION.RELEASE + ")"; }

        @JavascriptInterface
        public void openExternal(String url) {
            if (url != null && (url.startsWith("http://") || url.startsWith("https://")))
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        }
    }
}
