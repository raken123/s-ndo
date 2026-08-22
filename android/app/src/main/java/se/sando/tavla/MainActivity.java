package se.sando.tavla;

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Sändo Tavla — klassrumstavla för tablet och smartboard.
 * Hela gränssnittet ligger som lokala assets och körs i en WebView.
 */
public class MainActivity extends android.app.Activity {

    private static final int REQ_MEDIA = 4711;

    private WebView web;
    /* Flera förfrågningar kan komma tätt (mikrofon och sedan kamera) — de köas
       så att ingen av dem tappas bort och lämnar getUserMedia hängande. */
    private final List<PermissionRequest> pendingMedia = new ArrayList<>();
    private boolean askingPermissions;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                pendingMedia.remove(request);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { grantMedia(request); }
                });
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setBackgroundColor(0xFFF4F6FB);

        askUpfront();
        immersive(true);
        web.loadUrl("file:///android_asset/index.html");
    }

    /**
     * Ljuddetektorn och tramsdetektorn behöver mikrofon, kameravakten behöver kamera.
     * Både Androids runtime-behörighet och WebView-tillståndet måste ges.
     */
    /** Ber om mikrofon och kamera en gång vid start — då hinner Android bevilja
        dem innan detektorerna anropar getUserMedia. */
    private void askUpfront() {
        List<String> ask = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ask.add(Manifest.permission.RECORD_AUDIO);
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ask.add(Manifest.permission.CAMERA);
        }
        if (!ask.isEmpty()) {
            askingPermissions = true;
            requestPermissions(ask.toArray(new String[0]), REQ_MEDIA);
        }
    }

    private void grantMedia(PermissionRequest request) {
        List<String> wanted = new ArrayList<>();
        List<String> needed = new ArrayList<>();
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                wanted.add(r);
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.RECORD_AUDIO);
                }
            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                wanted.add(r);
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.CAMERA);
                }
            }
        }
        if (wanted.isEmpty()) {
            request.deny();
            return;
        }
        if (needed.isEmpty()) {
            request.grant(wanted.toArray(new String[0]));
            return;
        }
        pendingMedia.add(request);
        if (!askingPermissions) {
            askingPermissions = true;
            requestPermissions(needed.toArray(new String[0]), REQ_MEDIA);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code != REQ_MEDIA) {
            return;
        }
        askingPermissions = false;
        boolean anyDenied = false;
        for (PermissionRequest request : new ArrayList<>(pendingMedia)) {
            List<String> granted = new ArrayList<>();
            for (String r : request.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)
                        && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    granted.add(r);
                } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)
                        && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    granted.add(r);
                }
            }
            if (granted.isEmpty()) {
                request.deny();
                anyDenied = true;
            } else {
                request.grant(granted.toArray(new String[0]));
            }
        }
        pendingMedia.clear();
        if (anyDenied) {
            Toast.makeText(this, R.string.mic_denied, Toast.LENGTH_LONG).show();
        }
    }

    private void immersive(boolean on) {
        View d = getWindow().getDecorView();
        if (on) {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        } else {
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            immersive(true);
        }
    }

    /** Bakåtknappen stänger först öppet verktyg, sedan appen. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.App && App.handleBack()) ? 'true' : 'false'", value -> {
            if (!"\"true\"".equals(value) && !"true".equals(value)) {
                finish();
            }
        });
    }

    private class Bridge {
        /** Sparar tavlan som PNG i galleriet (Pictures/Sändo Tavla). */
        @JavascriptInterface
        public String saveImage(String base64, String name) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String fileName = (name == null || name.isEmpty() ? "tavla" : name) + ".png";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH,
                            Environment.DIRECTORY_PICTURES + "/Sando Tavla");
                    Uri uri = getContentResolver().insert(
                            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) {
                        return "Kunde inte spara bilden";
                    }
                    OutputStream out = getContentResolver().openOutputStream(uri);
                    out.write(bytes);
                    out.close();
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), "");
                    if (!dir.exists() && !dir.mkdirs()) {
                        return "Kunde inte skapa mappen";
                    }
                    FileOutputStream out = new FileOutputStream(new File(dir, fileName));
                    out.write(bytes);
                    out.close();
                }
                return "Bilden sparades som " + fileName;
            } catch (Exception e) {
                return "Kunde inte spara bilden: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public void setImmersive(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { immersive(on); }
            });
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }
}
