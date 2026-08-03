package com.pquit.blocker;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;

/** Ongoing countdown notification plus the alarm that clears it when the cooldown ends. */
final class LockNotifier {

    static final int ID_LOCKED = 4711;
    static final int ID_LIFTED = 4712;
    private static final String CHANNEL = "pquit_lock";

    private LockNotifier() {}

    private static NotificationManager nm(Context c) {
        return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, "Cooldown", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Shows how long is left on a PQuit cooldown");
        ch.setShowBadge(false);
        nm(c).createNotificationChannel(ch);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent();
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(c, 0, i, flags);
    }

    @SuppressWarnings("deprecation")
    static void showLocked(Context c, long remainingMs) {
        if (remainingMs <= 0) return;
        ensureChannel(c);

        Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(c, CHANNEL)
                : new Notification.Builder(c);

        b.setSmallIcon(android.R.drawable.ic_lock_idle_lock)
                .setContentTitle("PQuit cooldown running")
                .setContentText("Chrome, Edge, TikTok and YouTube are on hold - "
                        + BlockActivity.format(remainingMs) + " left")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp(c));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            b.setUsesChronometer(true)
                    .setChronometerCountDown(true)
                    .setWhen(System.currentTimeMillis() + remainingMs);
        }
        try {
            nm(c).notify(ID_LOCKED, b.build());
        } catch (SecurityException ignored) {
            // Notifications not granted (API 33+) - the block itself still works.
        }
    }

    @SuppressWarnings("deprecation")
    static void showLifted(Context c) {
        ensureChannel(c);
        Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                ? new Notification.Builder(c, CHANNEL)
                : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_lock_idle_lock)
                .setContentTitle("Cooldown finished")
                .setContentText("Apps are unlocked. Still want it, or did that pass?")
                .setAutoCancel(true)
                .setContentIntent(openApp(c));
        try {
            nm(c).notify(ID_LIFTED, b.build());
        } catch (SecurityException ignored) { }
    }

    static void clearLocked(Context c) {
        nm(c).cancel(ID_LOCKED);
    }

    static void scheduleExpiry(Context c, long remainingMs) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(
                c, 1, new Intent(c, LockExpiryReceiver.class), flags);
        long at = SystemClock.elapsedRealtime() + remainingMs + 1000;
        // Inexact on purpose: exact alarms need a special grant on Android 12+, and a
        // notification that lands a minute late costs nothing.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
        } else {
            am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
        }
    }
}
