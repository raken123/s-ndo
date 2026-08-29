package se.sando.elev;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

/**
 * Sändo Elev — en WebView runt webbappen i ../elev.
 *
 * Skalet är avsiktligt tunt. Appen är gjord för en telefon och behöver bara
 * några få saker av Android som webben inte ger den själv: en filväljare för
 * arbetsboken, en tillbakaknapp som backar i appen, ett tangentbord som inte
 * lägger sig över skrivraden, positionen till Matteplatser, och en väg att
 * lämna över det bilskärmen ska visa.
 *
 * Varför https och inte file://
 * -----------------------------
 * Appen laddades tidigare från {@code file:///android_asset/index.html}. Det
 * såg ut att fungera — vyerna ritades, knapparna gick att trycka på — men
 * ingenting som krävde nätet gjorde något: Monni svarade aldrig och
 * arbetsboken gick inte att ladda upp.
 *
 * Orsaken är att en WebView sedan API 16 har
 * {@code allowUniversalAccessFromFileURLs = false}. En sida på file:// har
 * inget riktigt ursprung och får inte göra fetch till någon annan adress, så
 * varje anrop till generativelanguage.googleapis.com dog i WebView:n innan det
 * ens blev ett nätverksanrop. Appen visade "Kunde inte nå Monni".
 *
 * Flaggan går att slå på, och det är fel väg: den ger vilken lokal html-fil
 * som helst rätt att läsa vad som helst. I stället serveras assets över ett
 * riktigt https-ursprung med {@link WebViewAssetLoader}. Då blir det en vanlig
 * CORS-förfrågan, localStorage får ett stabilt ursprung, och
 * {@code navigator.geolocation} börjar fungera — den vägrar också på file://.
 */
public class MainActivity extends Activity {

    private static final int VALJ_FIL = 4711;
    private static final int BE_OM_PLATS = 4712;

    /** Reserverat av Google för just det här och slår aldrig upp mot en riktig server. */
    private static final String VARD = "appassets.androidplatform.net";
    private static final String START = "https://" + VARD + "/assets/index.html";

    private WebView web;
    private ValueCallback<Uri[]> filSvar;
    private WebViewAssetLoader assets;

    /** Sidan bad om positionen innan användaren hunnit säga ja. */
    private String vantandeUrsprung;
    private GeolocationPermissions.Callback vantandeSvar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        assets = new WebViewAssetLoader.Builder()
                .setDomain(VARD)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        setContentView(web);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          /* localStorage: bok, samtal, krediter */
        s.setGeolocationEnabled(true);         /* Matteplatser */
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);           /* appen är byggd i css-pixlar för mobil */
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                    /* systemets textstorlek får inte spränga layouten */
        s.setSafeBrowsingEnabled(true);

        /* Assets ligger inte längre på file://, så de här behövs inte — och att
           lämna dem på vore att lämna kvar en läsväg in i appens egna filer. */
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return assets.shouldInterceptRequest(r.getUrl());
            }

            /* Appens eget värdnamn stannar i appen. Allt annat är en riktig
               länk utåt och öppnas i webbläsaren i stället för att kapa vyn. */
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u == null || VARD.equals(u.getHost())) return false;
                if ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                        return true;
                    } catch (Exception ignored) { /* ingen webbläsare — låt WebView ta det */ }
                }
                return false;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            /* Filväljaren för PDF:en. Utan den gör knappen "Ladda upp arbetsbok"
               ingenting alls i en WebView. */
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

            /* Två lager tillstånd: Android frågar användaren, och WebView frågar
               oss. Sidan får ja först när båda sagt ja. */
            @Override
            public void onGeolocationPermissionsShowPrompt(String ursprung,
                                                           GeolocationPermissions.Callback cb) {
                if (harPlatsRatt()) { cb.invoke(ursprung, true, true); return; }
                vantandeUrsprung = ursprung;
                vantandeSvar = cb;
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION }, BE_OM_PLATS);
            }
        });

        web.addJavascriptInterface(new Bro(), "SandoBro");

        web.setBackgroundColor(0xFFF3F6F7);
        web.loadUrl(START);

        /* Statusraden får appens färg, och innehållet läggs innanför den —
           css:en räknar själv med safe-area-insets. */
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
    }

    private boolean harPlatsRatt() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] ratter, int[] svar) {
        if (req != BE_OM_PLATS) {
            super.onRequestPermissionsResult(req, ratter, svar);
            return;
        }
        if (vantandeSvar == null) return;
        boolean ja = false;
        for (int r : svar) if (r == PackageManager.PERMISSION_GRANTED) ja = true;
        vantandeSvar.invoke(vantandeUrsprung, ja, false);
        vantandeSvar = null;
        vantandeUrsprung = null;
    }

    /**
     * Det webbappen lämnar över till bilskärmen.
     *
     * Bara tre nycklar, och {@link Delat#skriv} tar inga andra. En bro med ett
     * fritt skrivbart lager i andra änden är en bro för vem som helst som
     * råkar hamna i WebView:n.
     */
    private final class Bro {
        @JavascriptInterface
        public void spara(String nyckel, String json) {
            Delat.skriv(MainActivity.this, nyckel, json);
        }

        /** Webbappen visar Android Auto-raden bara när den faktiskt finns. */
        @JavascriptInterface
        public boolean harBil() {
            return true;
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
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
