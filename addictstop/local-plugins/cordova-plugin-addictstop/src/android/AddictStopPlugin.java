package com.addictstop.block;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

/**
 * Bridge between the prayer UI in the WebView and the pieces of Android that
 * can actually hold a lock: the accessibility service, the alarm manager and
 * the notification shade.
 */
public class AddictStopPlugin extends CordovaPlugin {

    private CallbackContext eventCallback;

    @Override
    protected void pluginInitialize() {
        Notifier.ensureChannel(cordova.getContext());
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext cb) throws JSONException {
        Context context = cordova.getContext();

        if ("getStatus".equals(action)) {
            cb.success(status(context));
            return true;
        }
        if ("setArmed".equals(action)) {
            LockState.setArmed(context, args.optBoolean(0, false));
            if (!LockState.isArmed(context)) {
                Scheduler.cancelAll(context);
                LockState.unlock(context);
                Notifier.clear(context);
            } else {
                Scheduler.arm(context);
            }
            cb.success(status(context));
            return true;
        }
        if ("schedule".equals(action)) {
            Scheduler.save(context, args.optJSONArray(0));
            JSONObject result = new JSONObject();
            result.put("armed", Scheduler.arm(context));
            cb.success(result);
            return true;
        }
        if ("lock".equals(action)) {
            // Raised from the WebView, so the app is in front and playing the
            // adhan itself: the notification stays quiet.
            LockState.lock(context, args.optString(0, "Prayer"), args.optInt(1, 2));
            Notifier.postLockNotification(context, args.optString(0, "Prayer"), true);
            cb.success(status(context));
            return true;
        }
        if ("unlock".equals(action)) {
            LockState.unlock(context);
            Notifier.clear(context);
            Scheduler.arm(context);
            cb.success(status(context));
            return true;
        }
        if ("consumeTrigger".equals(action)) {
            JSONObject result = new JSONObject();
            result.put("prayer", LockState.pendingTrigger(context));
            LockState.clearPendingTrigger(context);
            cb.success(result);
            return true;
        }
        if ("openAccessibilitySettings".equals(action)) {
            open(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS), cb);
            return true;
        }
        if ("openOverlaySettings".equals(action)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + context.getPackageName()));
            open(intent, cb);
            return true;
        }
        if ("openExactAlarmSettings".equals(action)) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + context.getPackageName())), cb);
            } else {
                cb.success(status(context));
            }
            return true;
        }
        if ("openBatterySettings".equals(action)) {
            open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), cb);
            return true;
        }
        if ("openNotificationSettings".equals(action)) {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            open(intent, cb);
            return true;
        }
        if ("watch".equals(action)) {
            eventCallback = cb;
            PluginResult keep = new PluginResult(PluginResult.Status.NO_RESULT);
            keep.setKeepCallback(true);
            cb.sendPluginResult(keep);
            reportLaunchIntent(cordova.getActivity().getIntent());
            return true;
        }
        return false;
    }

    private void open(final Intent intent, final CallbackContext cb) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    cordova.getActivity().startActivity(intent);
                    cb.success();
                } catch (Exception e) {
                    cb.error("Could not open that settings screen on this device.");
                }
            }
        });
    }

    private JSONObject status(Context context) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("locked", LockState.isLocked(context));
        o.put("armed", LockState.isArmed(context));
        o.put("prayer", LockState.prayer(context));
        o.put("rakahs", LockState.rakahs(context));
        o.put("lockedSince", LockState.lockedSince(context));
        o.put("accessibility", isAccessibilityEnabled(context));
        o.put("overlay", canDrawOverlays(context));
        o.put("exactAlarms", canScheduleExact(context));
        o.put("notifications", notificationsEnabled(context));
        o.put("batteryUnrestricted", ignoringBatteryOptimizations(context));
        o.put("sdk", Build.VERSION.SDK_INT);
        return o;
    }

    private boolean isAccessibilityEnabled(Context context) {
        AccessibilityManager am = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) {
            return false;
        }
        List<AccessibilityServiceInfo> enabled =
                am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
        String target = context.getPackageName() + "/" + AppBlockService.class.getName();
        for (AccessibilityServiceInfo info : enabled) {
            if (target.equalsIgnoreCase(info.getId())) {
                return true;
            }
            if (info.getId() != null && info.getId().contains(AppBlockService.class.getName())) {
                return true;
            }
        }
        return false;
    }

    private boolean canDrawOverlays(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    private boolean canScheduleExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    private boolean notificationsEnabled(Context context) {
        android.app.NotificationManager nm =
                (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || nm.areNotificationsEnabled();
    }

    private boolean ignoringBatteryOptimizations(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Activity activity = cordova.getActivity();
        if (activity != null) {
            activity.setIntent(intent);
        }
        reportLaunchIntent(intent);
    }

    @Override
    public void onResume(boolean multitasking) {
        super.onResume(multitasking);
        sendEvent("resume", null);
    }

    /** Tell the UI why it was brought to the front: an adhan, or a blocked app. */
    private void reportLaunchIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String reason = intent.getStringExtra(Notifier.EXTRA_REASON);
        if (reason == null) {
            return;
        }
        JSONObject payload = new JSONObject();
        try {
            payload.put("prayer", intent.getStringExtra(Notifier.EXTRA_PRAYER));
            payload.put("blocked", intent.getStringExtra(Notifier.EXTRA_BLOCKED_PACKAGE));
        } catch (JSONException ignored) {
            // payload stays partial; the reason is the part that matters
        }
        intent.removeExtra(Notifier.EXTRA_REASON);
        sendEvent(reason, payload);
    }

    private void sendEvent(String type, JSONObject payload) {
        if (eventCallback == null) {
            return;
        }
        JSONObject event = new JSONObject();
        try {
            event.put("type", type);
            event.put("payload", payload == null ? new JSONObject() : payload);
        } catch (JSONException e) {
            return;
        }
        PluginResult result = new PluginResult(PluginResult.Status.OK, event);
        result.setKeepCallback(true);
        eventCallback.sendPluginResult(result);
    }
}
