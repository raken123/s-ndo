package com.addictstop.block;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * The adhan notification.
 *
 * Two channels, because the sound of a notification channel is fixed the moment
 * the channel is created and there are two different moments to cover:
 *
 *  - CHANNEL_ADHAN plays the bundled recitation (res/raw/adhan.mp3) and carries
 *    a full-screen intent. This is the alarm firing while you are elsewhere.
 *  - CHANNEL_LOCK is silent and low priority. It is the standing "your apps are
 *    locked" note, used when the lock is raised with the app already open and
 *    the WebView is playing the adhan itself.
 */
public final class Notifier {

    public static final String EXTRA_REASON = "addictstop.reason";
    public static final String EXTRA_PRAYER = "addictstop.prayer";
    public static final String EXTRA_BLOCKED_PACKAGE = "addictstop.blocked";

    /* Versioned: a channel's sound cannot be changed once it exists, so a new
     * sound needs a new id to reach phones that already ran an older build. */
    private static final String CHANNEL_ADHAN = "addictstop_adhan_v2";
    private static final String CHANNEL_LOCK = "addictstop_lock_v2";
    private static final String CHANNEL_LEGACY = "addictstop_adhan";

    private static final int NOTIFICATION_ID = 4711;

    private Notifier() {
    }

    /** The bundled recitation, as a resource URI the notification manager can play. */
    public static Uri adhanUri(Context context) {
        return Uri.parse("android.resource://" + context.getPackageName() + "/raw/adhan");
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            return;
        }
        // Drop the pre-adhan channel so its default alarm tone stops showing up
        // in the notification settings of an upgraded install.
        if (nm.getNotificationChannel(CHANNEL_LEGACY) != null) {
            nm.deleteNotificationChannel(CHANNEL_LEGACY);
        }

        if (nm.getNotificationChannel(CHANNEL_ADHAN) == null) {
            NotificationChannel adhan = new NotificationChannel(
                    CHANNEL_ADHAN, "Adhan", NotificationManager.IMPORTANCE_HIGH);
            adhan.setDescription("The call to prayer, when a prayer time starts and your apps lock.");
            adhan.setBypassDnd(true);
            adhan.enableVibration(true);
            adhan.setSound(
                    adhanUri(context),
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
            nm.createNotificationChannel(adhan);
        }

        if (nm.getNotificationChannel(CHANNEL_LOCK) == null) {
            NotificationChannel lock = new NotificationChannel(
                    CHANNEL_LOCK, "Lock status", NotificationManager.IMPORTANCE_LOW);
            lock.setDescription("The quiet reminder that your apps are locked until you have prayed.");
            lock.setSound(null, null);
            lock.enableVibration(false);
            nm.createNotificationChannel(lock);
        }
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

    /**
     * @param silent true when the app is already in front and playing the adhan
     *               itself, so the notification must not play it a second time.
     */
    public static void postLockNotification(Context context, String prayer, boolean silent) {
        ensureChannel(context);
        String name = prayer == null ? "Prayer" : prayer;

        PendingIntent content = appIntent(context, prayer);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, silent ? CHANNEL_LOCK : CHANNEL_ADHAN);
        } else {
            builder = new Notification.Builder(context);
            builder.setPriority(silent ? Notification.PRIORITY_LOW : Notification.PRIORITY_MAX);
            if (!silent) {
                builder.setSound(adhanUri(context), android.media.AudioManager.STREAM_ALARM);
            }
        }

        builder.setContentTitle(silent ? "Apps locked for " + name : "It is time for " + name)
                .setContentText("Follow the stickman through " + name + " to unlock.")
                .setSmallIcon(context.getApplicationInfo().icon)
                .setCategory(silent ? Notification.CATEGORY_STATUS : Notification.CATEGORY_ALARM)
                .setAutoCancel(false)
                .setOngoing(true)
                .setContentIntent(content);

        if (!silent) {
            builder.setFullScreenIntent(content, true);
        }

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
