package com.pquit.blocker;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.SystemClock;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * The single source of truth for "is the cooldown running, and is this app allowed".
 *
 * Both the WebView plugin and the AccessibilityService live in the same process, but the
 * service can outlive the Activity, so everything goes through SharedPreferences rather
 * than static fields.
 *
 * The deadline is stored twice: as wall-clock time (what the UI shows) and as
 * elapsedRealtime (immune to the user winding the clock forward to escape early). The
 * lock is over only when both have passed.
 */
public final class LockState {

    private static final String PREFS = "pquit_lock";
    private static final String KEY_END_WALL = "ends_at_wall";
    private static final String KEY_END_ELAPSED = "ends_at_elapsed";
    private static final String KEY_STARTED_AT = "started_at";
    private static final String KEY_DURATION = "duration_ms";
    private static final String KEY_STRICT = "strict_mode";
    private static final String KEY_TOTAL_LOCKS = "total_locks";

    /** Named by the user. These ship preinstalled on most phones, so "system app" is no defence. */
    private static final Set<String> ALWAYS_BLOCKED = new HashSet<>(Arrays.asList(
            // Chrome
            "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
            // Edge
            "com.microsoft.emmx", "com.microsoft.emmx.beta", "com.microsoft.emmx.dev",
            "com.microsoft.emmx.canary",
            // TikTok
            "com.zhiliaoapp.musically", "com.zhiliaoapp.musically.go", "com.ss.android.ugc.trill",
            "com.ss.android.ugc.aweme", "com.ss.android.ugc.aweme.lite",
            // YouTube
            "com.google.android.youtube", "com.google.android.apps.youtube.mango",
            "com.google.android.apps.youtube.music",
            // other stock browsers people reach for next
            "org.mozilla.firefox", "org.mozilla.fenix", "com.opera.browser",
            "com.opera.mini.native", "com.opera.gx", "com.brave.browser",
            "com.sec.android.app.sbrowser", "com.samsung.android.app.sbrowser",
            "com.duckduckgo.mobile.android", "com.microsoft.bing", "com.UCMobile.intl",
            "com.android.browser", "com.google.android.googlequicksearchbox"
    ));

    /** Never bounced, even in strict mode - locking yourself out of these is dangerous. */
    private static final Set<String> NEVER_BLOCKED = new HashSet<>(Arrays.asList(
            "com.android.systemui",
            "com.android.settings",
            "com.android.emergency",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.android.contacts",
            "com.google.android.contacts",
            "com.android.server.telecom",
            "com.android.phone",
            "com.android.incallui",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.mms",
            "com.google.android.apps.messaging"
    ));

    private LockState() {}

    static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Starts a cooldown. Extends an existing one but can never shorten it. */
    public static long start(Context c, long durationMs) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        long endWall = now + durationMs;
        long endElapsed = SystemClock.elapsedRealtime() + durationMs;

        if (remaining(c) > 0 && p.getLong(KEY_END_WALL, 0) > endWall) {
            return p.getLong(KEY_END_WALL, 0);
        }
        p.edit()
                .putLong(KEY_END_WALL, endWall)
                .putLong(KEY_END_ELAPSED, endElapsed)
                .putLong(KEY_STARTED_AT, now)
                .putLong(KEY_DURATION, durationMs)
                .putInt(KEY_TOTAL_LOCKS, p.getInt(KEY_TOTAL_LOCKS, 0) + 1)
                .apply();
        return endWall;
    }

    public static long endsAt(Context c) {
        return prefs(c).getLong(KEY_END_WALL, 0);
    }

    public static long duration(Context c) {
        return prefs(c).getLong(KEY_DURATION, 0);
    }

    public static int totalLocks(Context c) {
        return prefs(c).getInt(KEY_TOTAL_LOCKS, 0);
    }

    /**
     * Milliseconds left, or 0. Takes whichever clock says more time is left so that
     * changing the system time cannot end the cooldown early.
     */
    public static long remaining(Context c) {
        SharedPreferences p = prefs(c);
        long endWall = p.getLong(KEY_END_WALL, 0);
        if (endWall == 0) return 0;

        long byWall = endWall - System.currentTimeMillis();
        long byElapsed = p.getLong(KEY_END_ELAPSED, 0) - SystemClock.elapsedRealtime();

        // After a reboot elapsedRealtime restarts near zero, so byElapsed goes wildly
        // negative - fall back to wall clock in that case.
        long left = (byElapsed < -p.getLong(KEY_DURATION, 0)) ? byWall : Math.max(byWall, byElapsed);
        return Math.max(0, left);
    }

    public static boolean isLocked(Context c) {
        return remaining(c) > 0;
    }

    /** Strict mode also blocks every app that did not ship with the phone. */
    public static boolean strict(Context c) {
        return prefs(c).getBoolean(KEY_STRICT, true);
    }

    public static void setStrict(Context c, boolean strict) {
        prefs(c).edit().putBoolean(KEY_STRICT, strict).apply();
    }

    public static boolean isBlocked(Context c, String pkg) {
        if (pkg == null || pkg.isEmpty()) return false;
        if (pkg.equals(c.getPackageName())) return false;
        if (NEVER_BLOCKED.contains(pkg)) return false;
        if (isLauncher(c, pkg)) return false;
        if (ALWAYS_BLOCKED.contains(pkg)) return true;
        return strict(c) && !isPreinstalled(c, pkg);
    }

    /** True for apps that came with the phone (or system apps later updated from the store). */
    private static boolean isPreinstalled(Context c, String pkg) {
        try {
            ApplicationInfo info = c.getPackageManager().getApplicationInfo(pkg, 0);
            int flags = ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP;
            return (info.flags & flags) != 0;
        } catch (PackageManager.NameNotFoundException e) {
            // Cannot see it (no QUERY_ALL_PACKAGES grant, or it vanished) - do not block.
            return true;
        }
    }

    private static boolean isLauncher(Context c, String pkg) {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        PackageManager pm = c.getPackageManager();
        ResolveInfo def = pm.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        if (def != null && def.activityInfo != null && pkg.equals(def.activityInfo.packageName)) {
            return true;
        }
        for (ResolveInfo ri : pm.queryIntentActivities(home, 0)) {
            if (ri.activityInfo != null && pkg.equals(ri.activityInfo.packageName)) return true;
        }
        return false;
    }
}
