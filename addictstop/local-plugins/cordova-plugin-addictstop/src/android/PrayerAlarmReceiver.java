package com.addictstop.block;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

/**
 * The adhan moment: flip the lock on, ring, and try to put AddictStop in front
 * of whatever the phone was doing.
 */
public class PrayerAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "AddictStop";

    @Override
    public void onReceive(Context context, Intent intent) {
        String name = intent.getStringExtra("name");
        int rakahs = intent.getIntExtra("rakahs", 2);
        Log.i(TAG, "adhan alarm for " + name);

        if (!LockState.isArmed(context)) {
            return;
        }

        LockState.lock(context, name, rakahs);
        wake(context);
        // Not silent: this is the adhan itself, and the app is not necessarily
        // open to play it.
        Notifier.postLockNotification(context, name, false);

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launch.putExtra(Notifier.EXTRA_REASON, "adhan");
            launch.putExtra(Notifier.EXTRA_PRAYER, name);
            try {
                context.startActivity(launch);
            } catch (Exception e) {
                // Expected on newer releases when nothing grants us a background
                // start; the full-screen notification covers it.
                Log.i(TAG, "background start refused, notification will carry it");
            }
        }

        // Re-arm from the stored list so the following prayers stay scheduled
        // even if the app is never opened.
        Scheduler.arm(context);
    }

    private void wake(Context context) {
        // From Oreo on, the notification's full-screen intent is what turns the
        // screen on; FULL_WAKE_LOCK is deprecated and ignored there.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return;
        }
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm == null) {
            return;
        }
        try {
            PowerManager.WakeLock lock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "AddictStop:adhan");
            lock.acquire(8000L);
        } catch (Exception e) {
            Log.w(TAG, "could not take wake lock", e);
        }
    }
}
