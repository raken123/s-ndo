package com.pquit.blocker;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** JS bridge for the cooldown lock, the permission screens, and screen-time stats. */
public class PQuitBlocker extends CordovaPlugin {

    private static final String SERVICE_CLASS = "com.pquit.blocker.PQuitAccessibilityService";
    private static final int REQ_NOTIFICATIONS = 9101;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext cb)
            throws JSONException {
        switch (action) {
            case "getStatus":
                cb.success(status());
                return true;

            case "startLock": {
                long minutes = args.optLong(0, 60);
                if (minutes < 1) minutes = 1;
                if (minutes > 24 * 60) minutes = 24 * 60;
                long durationMs = minutes * 60_000L;
                Context c = ctx();
                LockState.start(c, durationMs);
                long left = LockState.remaining(c);
                LockNotifier.showLocked(c, left);
                LockNotifier.scheduleExpiry(c, left);
                cb.success(status());
                return true;
            }

            case "setStrictMode":
                LockState.setStrict(ctx(), args.optBoolean(0, true));
                cb.success(status());
                return true;

            case "openAccessibilitySettings":
                open(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), cb);
                return true;

            case "openUsageAccessSettings":
                open(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS), cb);
                return true;

            case "openAppSettings": {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.parse("package:" + ctx().getPackageName()));
                open(i, cb);
                return true;
            }

            case "openScreenTime":
                openScreenTime(cb);
                return true;

            case "requestNotifications":
                if (Build.VERSION.SDK_INT >= 33
                        && !cordova.hasPermission("android.permission.POST_NOTIFICATIONS")) {
                    cordova.requestPermission(this, REQ_NOTIFICATIONS,
                            "android.permission.POST_NOTIFICATIONS");
                }
                cb.success();
                return true;

            case "getScreenTime": {
                final long sinceMs = args.optLong(0, 24 * 60 * 60 * 1000L);
                final CallbackContext done = cb;
                cordova.getThreadPool().execute(() -> {
                    try {
                        done.success(screenTime(sinceMs));
                    } catch (JSONException e) {
                        done.error(String.valueOf(e.getMessage()));
                    }
                });
                return true;
            }

            default:
                return false;
        }
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] results) {
        // Nothing to do: notifications are a nice-to-have, the lock does not depend on them.
    }

    private Context ctx() {
        return cordova.getActivity().getApplicationContext();
    }

    private void open(Intent intent, CallbackContext cb) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            cordova.getActivity().startActivity(intent);
            cb.success();
        } catch (Exception e) {
            cb.error("Could not open that settings screen on this device.");
        }
    }

    /** Digital Wellbeing (or the OEM equivalent), falling back to system settings. */
    private void openScreenTime(CallbackContext cb) {
        String[] candidates = {
                "com.google.android.apps.wellbeing",   // Pixel / stock
                "com.samsung.android.forest",          // Samsung Digital Wellbeing
                "com.miui.securitycenter",             // Xiaomi
        };
        PackageManager pm = ctx().getPackageManager();
        for (String pkg : candidates) {
            Intent i = pm.getLaunchIntentForPackage(pkg);
            if (i != null) {
                open(i, cb);
                return;
            }
        }
        open(new Intent(Settings.ACTION_SETTINGS), cb);
    }

    private JSONObject status() throws JSONException {
        Context c = ctx();
        long remaining = LockState.remaining(c);
        JSONObject o = new JSONObject();
        o.put("locked", remaining > 0);
        o.put("remainingMs", remaining);
        o.put("endsAt", LockState.endsAt(c));
        o.put("durationMs", LockState.duration(c));
        o.put("totalLocks", LockState.totalLocks(c));
        o.put("strictMode", LockState.strict(c));
        o.put("accessibilityEnabled", isAccessibilityEnabled());
        o.put("serviceConnected", PQuitAccessibilityService.isConnected());
        o.put("usageAccess", hasUsageAccess());
        if (remaining <= 0) LockNotifier.clearLocked(c);
        return o;
    }

    private boolean isAccessibilityEnabled() {
        Context c = ctx();
        String enabled = Settings.Secure.getString(
                c.getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (TextUtils.isEmpty(enabled)) return false;
        String me = c.getPackageName() + "/" + SERVICE_CLASS;
        for (String part : enabled.split(":")) {
            if (part.equalsIgnoreCase(me)) return true;
        }
        return false;
    }

    private boolean hasUsageAccess() {
        Context c = ctx();
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        int mode;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(), c.getPackageName());
            } else {
                mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(), c.getPackageName());
            }
        } catch (Exception e) {
            return false;
        }
        if (mode == AppOpsManager.MODE_DEFAULT) {
            return c.checkCallingOrSelfPermission("android.permission.PACKAGE_USAGE_STATS")
                    == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /** Foreground time per app over the given window, biggest first. */
    private JSONObject screenTime(long sinceMs) throws JSONException {
        Context c = ctx();
        JSONObject out = new JSONObject();
        out.put("usageAccess", hasUsageAccess());
        out.put("windowMs", sinceMs);
        JSONArray apps = new JSONArray();
        out.put("apps", apps);
        out.put("totalMs", 0);
        out.put("blockedMs", 0);

        UsageStatsManager usm =
                (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null || !hasUsageAccess()) return out;

        long end = System.currentTimeMillis();
        long start = end - sinceMs;
        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, start, end);
        if (stats == null || stats.isEmpty()) return out;

        // queryUsageStats can return several buckets per package - fold them together.
        Map<String, Long> byPkg = new HashMap<>();
        for (UsageStats s : stats) {
            long t = s.getTotalTimeInForeground();
            if (t <= 0) continue;
            Long prev = byPkg.get(s.getPackageName());
            byPkg.put(s.getPackageName(), prev == null ? t : Math.max(prev, t));
        }

        List<Map.Entry<String, Long>> entries = new ArrayList<>(byPkg.entrySet());
        Collections.sort(entries, new Comparator<Map.Entry<String, Long>>() {
            @Override
            public int compare(Map.Entry<String, Long> a, Map.Entry<String, Long> b) {
                return Long.compare(b.getValue(), a.getValue());
            }
        });

        PackageManager pm = c.getPackageManager();
        long total = 0, blocked = 0;
        int shown = 0;
        for (Map.Entry<String, Long> e : entries) {
            String pkg = e.getKey();
            long ms = e.getValue();
            if (ms < 30_000) continue;
            total += ms;
            boolean isBlocked = LockState.isBlocked(c, pkg);
            if (isBlocked) blocked += ms;
            if (shown++ >= 12) continue;

            String label = pkg;
            try {
                ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
                label = String.valueOf(pm.getApplicationLabel(info));
            } catch (PackageManager.NameNotFoundException ignored) { }

            apps.put(new JSONObject()
                    .put("package", pkg)
                    .put("label", label)
                    .put("ms", ms)
                    .put("blocked", isBlocked));
        }
        out.put("totalMs", total);
        out.put("blockedMs", blocked);
        return out;
    }

    @Override
    public void onResume(boolean multitasking) {
        super.onResume(multitasking);
        Context c = ctx();
        long left = LockState.remaining(c);
        if (left > 0) {
            LockNotifier.showLocked(c, left);
        } else {
            LockNotifier.clearLocked(c);
        }
    }
}
