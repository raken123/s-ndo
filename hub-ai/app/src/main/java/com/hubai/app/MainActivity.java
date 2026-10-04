package com.hubai.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.security.SecureRandom;

/**
 * Hosts the Hub AI web UI (assets/www) and gives it two native abilities:
 * saving files to Downloads and the share sheet. The UI talks to Hub AI
 * Cloud itself over HTTPS. Hubs run in sandboxed iframes; because Android
 * injects the bridge into every frame, each call must carry a token that
 * only the top page receives.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";
    private static final int BLACK = 0xFF0D0D0D;

    private WebView web;
    private final String token = newToken();

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BLACK);
        web = new WebView(this);
        web.setBackgroundColor(BLACK);
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Draw behind the system bars on every Android version (Android 15
        // forces it anyway) and pad the page so nothing sits under them.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.addJavascriptInterface(new Bridge(), "HubNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) {
                    return false;
                }
                // Links to the web open in the browser, not inside the app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // Nothing can open it.
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript("window.HubBridge&&HubBridge._setToken("
                        + JSONObject.quote(token) + ")", null);
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.HubApp?HubApp.back():false", value -> {
            if (!"true".equals(value)) {
                finish();
            }
        });
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    private static String newToken() {
        byte[] b = new byte[24];
        new SecureRandom().nextBytes(b);
        return Base64.encodeToString(b, Base64.NO_WRAP | Base64.URL_SAFE);
    }

    private static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]+", "-");
        if (n.isEmpty() || n.startsWith(".")) {
            n = "hub" + n;
        }
        return n.length() > 80 ? n.substring(n.length() - 80) : n;
    }

    private static String result(boolean ok, String key, String value) {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", ok);
            o.put(key, value);
            return o.toString();
        } catch (JSONException e) {
            return "{\"ok\":false,\"error\":\"json\"}";
        }
    }

    /** Methods called from js/bridge.js. They run on the WebView's bridge thread. */
    private final class Bridge {

        @JavascriptInterface
        public String saveFile(String callToken, String name, String mime, String base64) {
            if (!token.equals(callToken)) {
                return result(false, "error", "Not allowed");
            }
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                String file = safeName(name);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver cr = getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, file);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Hub AI");
                    Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) {
                        return result(false, "error", "Could not create the file");
                    }
                    try (OutputStream out = cr.openOutputStream(uri)) {
                        if (out == null) {
                            return result(false, "error", "Could not open the file");
                        }
                        out.write(data);
                    }
                    return result(true, "path", "Downloads/Hub AI/" + file);
                }
                File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Hub AI");
                if (!dir.isDirectory() && !dir.mkdirs()) {
                    return result(false, "error", "Could not create " + dir);
                }
                File f = new File(dir, file);
                try (OutputStream out = new FileOutputStream(f)) {
                    out.write(data);
                }
                return result(true, "path", f.getAbsolutePath());
            } catch (IOException | IllegalArgumentException e) {
                return result(false, "error", String.valueOf(e.getMessage()));
            }
        }

        @JavascriptInterface
        public String shareFile(String callToken, String name, String mime, String base64, String text) {
            if (!token.equals(callToken)) {
                return result(false, "error", "Not allowed");
            }
            try {
                File dir = new File(getCacheDir(), "shared");
                if (!dir.isDirectory() && !dir.mkdirs()) {
                    return result(false, "error", "No space to share");
                }
                File f = new File(dir, safeName(name));
                try (OutputStream out = new FileOutputStream(f)) {
                    out.write(Base64.decode(base64, Base64.DEFAULT));
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, f.getName());
                if (text != null && !text.isEmpty()) {
                    send.putExtra(Intent.EXTRA_TEXT, text);
                }
                send.setClipData(ClipData.newRawUri(f.getName(), uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Share hub");
                runOnUiThread(() -> startActivity(chooser));
                return result(true, "path", f.getName());
            } catch (IOException | IllegalArgumentException e) {
                return result(false, "error", String.valueOf(e.getMessage()));
            }
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String appVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.0";
            }
        }
    }
}
