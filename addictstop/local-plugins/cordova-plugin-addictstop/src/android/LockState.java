package com.addictstop.block;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * The single source of truth for "are the apps locked right now".
 *
 * It lives in SharedPreferences because three separate processes-in-spirit read
 * it: the WebView (via the plugin), the alarm receiver, and the accessibility
 * service, and any of them can be alive while the others are not.
 */
public final class LockState {

    private static final String PREFS = "addictstop";

    private static final String KEY_LOCKED = "locked";
    private static final String KEY_PRAYER = "lockPrayer";
    private static final String KEY_RAKAHS = "lockRakahs";
    private static final String KEY_SINCE = "lockedSince";
    private static final String KEY_PENDING = "pendingTrigger";
    private static final String KEY_SCHEDULE = "schedule";
    private static final String KEY_ARMED = "armed";

    private LockState() {
    }

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean isLocked(Context context) {
        return prefs(context).getBoolean(KEY_LOCKED, false);
    }

    public static void lock(Context context, String prayer, int rakahs) {
        prefs(context).edit()
                .putBoolean(KEY_LOCKED, true)
                .putString(KEY_PRAYER, prayer)
                .putInt(KEY_RAKAHS, rakahs)
                .putLong(KEY_SINCE, System.currentTimeMillis())
                .putString(KEY_PENDING, prayer)
                .apply();
    }

    public static void unlock(Context context) {
        prefs(context).edit()
                .putBoolean(KEY_LOCKED, false)
                .remove(KEY_PRAYER)
                .remove(KEY_RAKAHS)
                .remove(KEY_PENDING)
                .apply();
    }

    public static String prayer(Context context) {
        return prefs(context).getString(KEY_PRAYER, null);
    }

    public static int rakahs(Context context) {
        return prefs(context).getInt(KEY_RAKAHS, 0);
    }

    public static long lockedSince(Context context) {
        return prefs(context).getLong(KEY_SINCE, 0L);
    }

    /** The prayer whose alarm fired and has not been acknowledged by the UI yet. */
    public static String pendingTrigger(Context context) {
        return prefs(context).getString(KEY_PENDING, null);
    }

    public static void clearPendingTrigger(Context context) {
        prefs(context).edit().remove(KEY_PENDING).apply();
    }

    /** Whether the user has armed protection at all (independent of the lock). */
    public static boolean isArmed(Context context) {
        return prefs(context).getBoolean(KEY_ARMED, false);
    }

    public static void setArmed(Context context, boolean armed) {
        prefs(context).edit().putBoolean(KEY_ARMED, armed).apply();
    }

    /** JSON array of upcoming prayers, kept so alarms survive a reboot. */
    public static String schedule(Context context) {
        return prefs(context).getString(KEY_SCHEDULE, null);
    }

    public static void setSchedule(Context context, String json) {
        prefs(context).edit().putString(KEY_SCHEDULE, json).apply();
    }
}
