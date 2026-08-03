package com.pquit.blocker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires when the cooldown runs out: drops the ongoing notification, says so once. */
public class LockExpiryReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        long left = LockState.remaining(context);
        if (left > 0) {
            // Woke up early (inexact alarm) - re-arm for what is actually left.
            LockNotifier.scheduleExpiry(context, left);
            return;
        }
        LockNotifier.clearLocked(context);
        LockNotifier.showLifted(context);
    }
}
