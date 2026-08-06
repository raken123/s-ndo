package com.addictstop.block;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/**
 * The adhan notification. It is filed as an alarm so it can use a full-screen
 * intent and get through Do Not Disturb the way a prayer call should.
 */
public final class Notifier {

    public static final String EXTRA_REASON = "addictstop.reason";
    public static final String EXTRA_PRAYER = "addictstop.prayer";
    public static final String EXTRA_BLOCKED_PACKAGE = "addictstop.blocked";

    private static final String CHANNEL_ID = "addictstop_adhan";
    private static final int NOTIFICATION_ID = 4711;

    private Notifier() {
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Adhan and lock", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Fires when a prayer time starts and your apps get locked.");
        channel.setBypassDnd(true);
        channel.enableVibration(true);
        channel.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        nm.createNotificationChannel(channel);
    }

    static PendingIntent appIntent(Context context, String prayer) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) {
            launch = new Intent();
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launch.putExtra(EXTRA_REASON, "adhan");
        launch.putExtra(EXTRA_PRAYER, prayer);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, 0, launch, flags);
    }

    public static void postLockNotification(Context context, String prayer) {
        ensureChannel(context);
        String name = prayer == null ? "Prayer" : prayer;

        PendingIntent content = appIntent(context, prayer);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
            builder.setPriority(Notification.PRIORITY_MAX);
            builder.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
        }

        builder.setContentTitle("It is time for " + name)
                .setContentText("Your apps are locked. Follow the stickman through " + name + " to unlock.")
                .setSmallIcon(context.getApplicationInfo().icon)
                .setCategory(Notification.CATEGORY_ALARM)
                .setAutoCancel(false)
                .setOngoing(true)
                .setContentIntent(content)
                .setFullScreenIntent(content, true);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, builder.build());
        }
    }

    public static void clear(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }
    }
}
