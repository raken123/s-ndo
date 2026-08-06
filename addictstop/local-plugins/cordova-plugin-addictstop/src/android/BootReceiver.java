package com.addictstop.block;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Alarms do not survive a reboot, a clock change or an app update, so re-arm
 * them from the stored schedule. The lock itself lives in preferences and
 * survives on its own -- rebooting is not a way out of Maghrib.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        Notifier.ensureChannel(context);
        Scheduler.arm(context);
        if (LockState.isLocked(context)) {
            Notifier.postLockNotification(context, LockState.prayer(context));
        }
    }
}
