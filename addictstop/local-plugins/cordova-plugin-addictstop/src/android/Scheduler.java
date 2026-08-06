package com.addictstop.block;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Arms one exact alarm per upcoming prayer.
 *
 * The WebView does the astronomy and hands down a plain list of
 * {key, name, rakahs, at} entries; this class only deals with clocks. The list
 * is kept in preferences so alarms can be re-armed after a reboot without the
 * app having to be opened.
 */
public final class Scheduler {

    private static final String TAG = "AddictStop";
    /** Roughly two and a half days of prayers, so alarms outlive a quiet weekend. */
    private static final int MAX_ALARMS = 12;
    private static final int REQUEST_BASE = 8100;

    private Scheduler() {
    }

    public static void save(Context context, JSONArray prayers) {
        LockState.setSchedule(context, prayers == null ? null : prayers.toString());
    }

    public static int arm(Context context) {
        cancelAll(context);
        String json = LockState.schedule(context);
        if (json == null || !LockState.isArmed(context)) {
            return 0;
        }

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return 0;
        }

        int armed = 0;
        long now = System.currentTimeMillis();
        try {
            JSONArray list = new JSONArray(json);
            for (int i = 0; i < list.length() && armed < MAX_ALARMS; i++) {
                JSONObject p = list.optJSONObject(i);
                if (p == null) {
                    continue;
                }
                long at = p.optLong("at", 0L);
                if (at <= now + 1000L) {
                    continue;
                }
                scheduleOne(context, am, armed, p.optString("key"), p.optString("name"), p.optInt("rakahs", 2), at);
                armed++;
            }
        } catch (JSONException e) {
            Log.w(TAG, "bad schedule payload", e);
        }
        Log.i(TAG, "armed " + armed + " prayer alarms");
        return armed;
    }

    private static void scheduleOne(Context context, AlarmManager am, int slot,
                                    String key, String name, int rakahs, long at) {
        Intent intent = new Intent(context, PrayerAlarmReceiver.class);
        intent.setAction("com.addictstop.block.PRAYER_" + slot);
        intent.putExtra("key", key);
        intent.putExtra("name", name);
        intent.putExtra("rakahs", rakahs);
        intent.putExtra("at", at);

        PendingIntent pi = pendingIntent(context, slot, intent, true);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            // Exact alarm permission revoked mid-flight: an inexact alarm still
            // fires, just later.
            Log.w(TAG, "exact alarm refused, falling back", e);
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    public static void cancelAll(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }
        for (int slot = 0; slot < MAX_ALARMS; slot++) {
            Intent intent = new Intent(context, PrayerAlarmReceiver.class);
            intent.setAction("com.addictstop.block.PRAYER_" + slot);
            PendingIntent pi = pendingIntent(context, slot, intent, false);
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        }
    }

    private static PendingIntent pendingIntent(Context context, int slot, Intent intent, boolean create) {
        int flags = create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, REQUEST_BASE + slot, intent, flags);
    }
}
