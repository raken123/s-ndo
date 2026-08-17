package com.aijudge.game;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PushbackInputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * AI Judge on Android.
 *
 * The game is one self-contained HTML file in assets. It is not loaded over
 * file:// but served from a loopback HTTP server this activity starts, because
 * http://127.0.0.1 is a secure context and file:// is not — that is what makes
 * localStorage, crypto.subtle and WebXR available.
 *
 * On a headset the same loopback URL can be handed to the system browser, which
 * does support immersive WebXR sessions; the in-app WebView does not.
 */
public class MainActivity extends Activity {

    private static final String TAG = "AIJudge";
    private static final String ASSET = "aijudge.html";

    private LoopbackServer server;
    private WebView web;
    private boolean vrBuild;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setBackgroundDrawableResource(android.R.color.black);

        vrBuild = metaFlag("aijudge.vr");

        try {
            server = new LoopbackServer(readAsset(ASSET));
            server.start();
        } catch (IOException e) {
            Log.e(TAG, "could not open the hall", e);
            finish();
            return;
        }

        FrameLayout rootView = new FrameLayout(this);
        rootView.setBackgroundColor(Color.parseColor("#120c07"));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
        web.setBackgroundColor(Color.parseColor("#120c07"));
        web.setWebViewClient(new HallWebViewClient(this));
        web.setWebChromeClient(new HallChromeClient());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags
                    & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        }
        rootView.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        if (vrBuild) rootView.addView(buildImmersiveButton());

        setContentView(rootView);
        goImmersive();
        web.loadUrl(server.origin() + "/");
    }

    /**
     * The WebView cannot start an immersive-vr session, so the VR build offers a
     * hand-off: the headset's own browser opens the same loopback URL and runs
     * the game in real WebXR.
     */
    private Button buildImmersiveButton() {
        Button b = new Button(this);
        b.setText("Open in headset browser  ·  full VR");
        b.setAllCaps(false);
        b.setTextColor(Color.parseColor("#2b1d08"));
        b.setBackgroundColor(Color.parseColor("#c8952e"));
        b.setPadding(48, 24, 48, 24);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        lp.bottomMargin = 36;
        b.setLayoutParams(lp);
        b.setOnClickListener(new ImmersiveHandoff(this));
        return b;
    }

    /* Every nested class here is static and takes the activity explicitly.
       That is deliberate: d8 in build-tools 34.0.0 fails to dex non-static inner
       classes ("Cannot invoke String.length()"), and holding the activity by an
       explicit field is clearer about the reference anyway. */

    /**
     * Keeps navigation inside the hall. Anything that is not the loopback origin
     * is somebody else's URL and belongs in a real browser.
     */
    private static final class HallWebViewClient extends WebViewClient {
        private final MainActivity host;

        HallWebViewClient(MainActivity host) {
            this.host = host;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, String url) {
            if (url != null && host.server != null && url.startsWith(host.server.origin())) {
                return false;
            }
            host.openExternally(url);
            return true;
        }
    }

    /** Routes the game's console output into logcat, which is where it is useful. */
    private static final class HallChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.d(TAG, m.message() + " @" + m.lineNumber());
            return true;
        }
    }

    /** Hands the loopback URL to the headset's browser for a real WebXR session. */
    private static final class ImmersiveHandoff implements View.OnClickListener {
        private final MainActivity host;

        ImmersiveHandoff(MainActivity host) {
            this.host = host;
        }

        @Override
        public void onClick(View v) {
            host.openExternally(host.server.origin() + "/");
        }
    }

    private void openExternally(String url) {
        if (url == null) return;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            Log.w(TAG, "no browser took " + url, e);
        }
    }

    private boolean metaFlag(String key) {
        try {
            Bundle meta = getPackageManager().getApplicationInfo(
                    getPackageName(), PackageManager.GET_META_DATA).metaData;
            return meta != null && meta.getBoolean(key, false);
        } catch (Exception e) {
            return false;
        }
    }

    private void goImmersive() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) return;
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    private byte[] readAsset(String name) throws IOException {
        InputStream in = getAssets().open(name);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(200 * 1024);
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (has) goImmersive();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        // The server outlives onPause on purpose: on a headset the player leaves
        // for the browser, and the browser still needs this port answering.
        if (server != null) server.shutdown();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /* ------------------------------------------------------------------ */

    /**
     * A loopback-only HTTP server that serves exactly one document. Small on
     * purpose: it exists to give the game a secure origin, not to be a web
     * server.
     */
    static final class LoopbackServer extends Thread {

        private final byte[] document;
        private final ServerSocket socket;
        private volatile boolean running = true;

        LoopbackServer(byte[] document) throws IOException {
            super("aijudge-http");
            setDaemon(true);
            this.document = document;
            this.socket = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        }

        String origin() {
            return "http://127.0.0.1:" + socket.getLocalPort();
        }

        @Override
        public void run() {
            while (running) {
                Socket client = null;
                try {
                    client = socket.accept();
                    client.setSoTimeout(5000);
                    serve(client);
                } catch (IOException e) {
                    if (running) Log.w(TAG, "request failed", e);
                } finally {
                    if (client != null) try { client.close(); } catch (IOException ignored) { }
                }
            }
        }

        private void serve(Socket client) throws IOException {
            PushbackInputStream in = new PushbackInputStream(client.getInputStream(), 1);
            String requestLine = readLine(in);
            if (requestLine == null) return;
            while (true) {
                String h = readLine(in);
                if (h == null || h.isEmpty()) break;   // end of headers
            }

            String[] parts = requestLine.split(" ");
            boolean ok = parts.length >= 2
                    && ("GET".equals(parts[0]) || "HEAD".equals(parts[0]))
                    && isGamePath(parts[1]);

            OutputStream out = client.getOutputStream();
            if (!ok) {
                out.write(("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n"
                        + "Connection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                out.flush();
                return;
            }

            String head = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: text/html; charset=utf-8\r\n"
                    + "Content-Length: " + document.length + "\r\n"
                    + "Cache-Control: no-store\r\n"
                    + "Connection: close\r\n\r\n";
            out.write(head.getBytes(StandardCharsets.US_ASCII));
            if (!"HEAD".equals(parts[0])) out.write(document);
            out.flush();
        }

        private boolean isGamePath(String target) {
            int q = target.indexOf('?');
            if (q >= 0) target = target.substring(0, q);
            return "/".equals(target) || "/index.html".equals(target) || "/aijudge.html".equals(target);
        }

        private String readLine(PushbackInputStream in) throws IOException {
            StringBuilder sb = new StringBuilder(128);
            int c;
            while ((c = in.read()) != -1) {
                if (c == '\n') return sb.toString();
                if (c != '\r') {
                    if (sb.length() > 4096) return sb.toString();   // no header novels
                    sb.append((char) c);
                }
            }
            return sb.length() > 0 ? sb.toString() : null;
        }

        void shutdown() {
            running = false;
            try { socket.close(); } catch (IOException ignored) { }
        }
    }
}
