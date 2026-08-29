package se.sando.elev;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Bron mellan telefonen och bilskärmen.
 *
 * Webbappen lever i en WebView och sparar allt i localStorage. Bilskärmen är
 * en helt annan process-del: {@link se.sando.elev.bil.SandoBilTjanst} har
 * ingen WebView och kan inte läsa localStorage. Så telefonen skriver hit, och
 * bilen läser härifrån.
 *
 * Riktningen är enkelriktad med flit. Bilen ändrar aldrig något — den visar.
 * Det finns varken tangentbord eller filväljare på en bilskärm, och ingenting
 * ska genereras medan någon kör.
 */
public final class Delat {

    private static final String FIL = "sandoelev.delat";
    private static final String KNUFFAR = "knuffar";
    private static final String PLATSER = "platser";
    private static final String KREDITER = "krediter";

    /** Så mycket som får plats på en bilskärm utan att någon behöver bläddra länge. */
    private static final int TAK = 8;

    private Delat() { }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(FIL, Context.MODE_PRIVATE);
    }

    /* ---------- knuffar ---------- */

    /** En sak Monni sagt, kort nog att läsas på en bilskärm. */
    public static final class Knuff {
        public final String fraga;
        public final String svar;
        public final int steg;
        public final long tid;

        public Knuff(String fraga, String svar, int steg, long tid) {
            this.fraga = fraga;
            this.svar = svar;
            this.steg = steg;
            this.tid = tid;
        }
    }

    public static List<Knuff> knuffar(Context c) {
        List<Knuff> ut = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString(KNUFFAR, "[]"));
            for (int i = 0; i < a.length() && ut.size() < TAK; i++) {
                JSONObject o = a.getJSONObject(i);
                ut.add(new Knuff(
                        o.optString("fraga", ""),
                        o.optString("svar", ""),
                        o.optInt("steg", 1),
                        o.optLong("tid", 0L)));
            }
        } catch (JSONException ignored) { /* tomt är ett giltigt tillstånd */ }
        return ut;
    }

    /* ---------- matteplatser ---------- */

    /** En plats i närheten, som den såg ut när telefonen senast tittade. */
    public static final class Plats {
        public final String id;
        public final String namn;
        public final double lat;
        public final double lon;
        public final int meter;
        public final int niva;
        public final boolean klar;

        public Plats(String id, String namn, double lat, double lon,
                     int meter, int niva, boolean klar) {
            this.id = id;
            this.namn = namn;
            this.lat = lat;
            this.lon = lon;
            this.meter = meter;
            this.niva = niva;
            this.klar = klar;
        }
    }

    public static List<Plats> platser(Context c) {
        List<Plats> ut = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(c).getString(PLATSER, "[]"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                ut.add(new Plats(
                        o.optString("id", ""),
                        o.optString("namn", "Matteplats"),
                        o.optDouble("lat", 0),
                        o.optDouble("lon", 0),
                        o.optInt("meter", 0),
                        o.optInt("niva", 1),
                        o.optBoolean("klar", false)));
            }
        } catch (JSONException ignored) { /* tomt är ett giltigt tillstånd */ }
        return ut;
    }

    public static long krediter(Context c) {
        return prefs(c).getLong(KREDITER, 5000000L);
    }

    /* ---------- skrivning ---------- */

    /**
     * Anropas från JavaScript. Nyckeln får bara vara en av de kända — annars
     * vore det här ett fritt skrivbart lager öppet för vilken sida som helst
     * som råkar laddas i WebView:n.
     */
    static void skriv(Context c, String nyckel, String json) {
        if (nyckel == null) return;
        SharedPreferences.Editor e = prefs(c).edit();
        switch (nyckel) {
            case KNUFFAR:
            case PLATSER:
                e.putString(nyckel, json == null ? "[]" : json);
                break;
            case KREDITER:
                long v;
                try { v = Long.parseLong(String.valueOf(json).trim()); }
                catch (NumberFormatException ex) { return; }
                e.putLong(KREDITER, v);
                break;
            default:
                return;
        }
        e.apply();
    }
}
