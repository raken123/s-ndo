package com.addictstop.block;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * While the lock is on, any app that comes to the foreground gets bounced: we
 * go home and bring AddictStop up in its place. The only thing this service
 * ever looks at is the package name of the window that just opened.
 *
 * A small allowlist keeps the phone usable in the ways it has to stay usable --
 * you can still place a call, and you can still reach Settings to turn this
 * service off. A lock you cannot escape is a broken phone, not discipline.
 */
public class AppBlockService extends AccessibilityService {

    private static final String TAG = "AddictStop";
    private static final long THROTTLE_MS = 900L;

    private final Set<String> allowed = new HashSet<String>();
    private long lastKick;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        buildAllowlist();
        Log.i(TAG, "block service connected, allowlist=" + allowed.size());
    }

    private void buildAllowlist() {
        allowed.clear();
        allowed.add(getPackageName());
        allowed.add("android");
        allowed.add("com.android.systemui");
        allowed.add("com.android.settings");           // never trap the user
        allowed.add("com.android.packageinstaller");
        allowed.add("com.google.android.packageinstaller");
        allowed.add("com.android.permissioncontroller");
        allowed.add("com.google.android.permissioncontroller");
        allowed.add("com.android.emergency");

        PackageManager pm = getPackageManager();
        addResolved(pm, new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME));
        addResolved(pm, new Intent(Intent.ACTION_DIAL, Uri.parse("tel:")));
        addResolved(pm, new Intent(Intent.ACTION_CALL, Uri.parse("tel:")));
    }

    private void addResolved(PackageManager pm, Intent intent) {
        try {
            List<ResolveInfo> matches = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo info : matches) {
                if (info.activityInfo != null && info.activityInfo.packageName != null) {
                    allowed.add(info.activityInfo.packageName);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "could not resolve allowlist intent", e);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }
        if (!LockState.isLocked(this)) {
            return;
        }
        CharSequence raw = event.getPackageName();
        if (raw == null) {
            return;
        }
        String pkg = raw.toString();
        if (allowed.isEmpty()) {
            buildAllowlist();
        }
        if (allowed.contains(pkg)) {
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (now - lastKick < THROTTLE_MS) {
            return;
        }
        lastKick = now;

        Log.i(TAG, "locked -- bouncing " + pkg);
        performGlobalAction(GLOBAL_ACTION_HOME);
        bringAppForward(pkg);
    }

    private void bringAppForward(String blockedPackage) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) {
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        launch.putExtra(Notifier.EXTRA_REASON, "blocked");
        launch.putExtra(Notifier.EXTRA_BLOCKED_PACKAGE, blockedPackage);
        try {
            startActivity(launch);
        } catch (Exception e) {
            // Background activity starts can still be refused on some builds;
            // the full-screen notification is the fallback path.
            Log.w(TAG, "could not start activity, falling back to notification", e);
            Notifier.postLockNotification(this, LockState.prayer(this), true);
        }
    }

    @Override
    public void onInterrupt() {
        // Nothing to interrupt: this service produces no feedback of its own.
    }
}
