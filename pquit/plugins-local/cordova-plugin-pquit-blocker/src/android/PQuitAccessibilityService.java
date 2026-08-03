package com.pquit.blocker;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * Watches window changes and bounces blocked apps back to the launcher while a cooldown
 * is running. This is the only way an unprivileged Android app can hold another app shut.
 */
public class PQuitAccessibilityService extends AccessibilityService {

    private static final String TAG = "PQuitBlocker";
    /** Don't re-fire the block screen for every window event of the same app. */
    private static final long RETRIGGER_MS = 900;

    private static volatile boolean connected = false;

    private String lastBlockedPkg = "";
    private long lastBlockAt = 0;

    public static boolean isConnected() {
        return connected;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
        setServiceInfo(info);
        connected = true;
        Log.i(TAG, "accessibility service connected");
    }

    @Override
    public void onDestroy() {
        connected = false;
        super.onDestroy();
    }

    @Override
    public void onInterrupt() { }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }
        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq == null) return;
        String pkg = pkgSeq.toString();

        long left = LockState.remaining(this);
        if (left <= 0) {
            lastBlockedPkg = "";
            return;
        }
        if (!LockState.isBlocked(this, pkg)) return;

        long now = SystemClock.elapsedRealtime();
        if (pkg.equals(lastBlockedPkg) && now - lastBlockAt < RETRIGGER_MS) return;
        lastBlockedPkg = pkg;
        lastBlockAt = now;

        performGlobalAction(GLOBAL_ACTION_HOME);
        showBlockScreen(pkg, left);
    }

    private void showBlockScreen(String pkg, long remainingMs) {
        try {
            Intent i = new Intent(this, BlockActivity.class)
                    .putExtra(BlockActivity.EXTRA_PACKAGE, pkg)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_NO_ANIMATION
                            | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            startActivity(i);
        } catch (Exception e) {
            // Sending the user home already did the important part.
            Log.w(TAG, "could not show block screen: " + e.getMessage());
        }
        LockNotifier.showLocked(this, remainingMs);
    }
}
