package se.sando.elev;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Sändo Elev — en WebView runt webbappen i ../elev.
 *
 * Skalet är avsiktligt tunt. Appen är gjord för en telefon och behöver bara
 * tre saker av Android som webben inte ger den själv:
 *
 *   1. En filväljare, så att eleven kan lägga upp sin arbetsbok som PDF.
 *   2. En tillbakaknapp som lämnar chatten i stället för att stänga appen.
 *   3. Att tangentbordet inte lägger sig över skrivraden.
 *
 * Ingen mikrofon, ingen kamera, inga behörigheter utöver internet. Monni är
 * en textmodell och appen ber aldrig om något annat.
 */
public class MainActivity extends Activity {

    private static final int VALJ_FIL = 4711;

    private WebView web;
    private ValueCallback<Uri[]> filSvar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        setContentView(web);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          /* localStorage: bok, samtal, krediter */
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);           /* appen är byggd i css-pixlar för mobil */
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                    /* systemets textstorlek får inte spränga layouten */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(true);
        }

        /* Webbappen ligger i assets. Länkar utåt öppnas i webbläsaren i stället
           för att kapa appens egen vy. */
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u != null && ("http".equals(u.getScheme()) || "https".equals(u.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                        return true;
                    } catch (Exception ignored) { /* ingen webbläsare — låt WebView ta det */ }
                }
                return false;
            }
        });

        /* Filväljaren för PDF:en. Utan den gör knappen "Ladda upp arbetsbok"
           ingenting alls i en WebView. */
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filSvar != null) filSvar.onReceiveValue(null);
                filSvar = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/pdf");
                    startActivityForResult(Intent.createChooser(i, "Välj din arbetsbok"), VALJ_FIL);
                    return true;
                } catch (Exception e) {
                    filSvar = null;
                    Toast.makeText(MainActivity.this,
                            "Hittade ingen filhanterare på telefonen", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        web.setBackgroundColor(0xFFF3F6F7);
        web.loadUrl("file:///android_asset/index.html");

        /* Statusraden får appens färg, och innehållet läggs innanför den —
           css:en räknar själv med safe-area-insets. */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != VALJ_FIL) {
            super.onActivityResult(req, res, data);
            return;
        }
        if (filSvar == null) return;
        Uri[] valda = null;
        if (res == RESULT_OK && data != null && data.getData() != null) {
            valda = new Uri[]{ data.getData() };
        }
        filSvar.onReceiveValue(valda);
        filSvar = null;
    }

    /* Tillbakaknappen ska backa i appen först. Står vi på startvyn lämnar den
       appen som vanligt. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){var s=document.getElementById('sheet');" +
                "if(s&&!s.classList.contains('hidden')){App.hideSheet();return 'ruta';}" +
                "if(App.aktivVy!=='bok'){App.open('bok');return 'vy';}return 'ut';})()",
                varde -> {
                    if (varde == null || varde.contains("ut")) {
                        finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
