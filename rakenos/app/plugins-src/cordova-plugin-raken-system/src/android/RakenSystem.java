package com.raken.rakenos.system;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.WindowManager;

import androidx.core.content.FileProvider;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * RakenOS system services.
 *
 * Capability detection reports what the hardware can do (camera, flash, NFC,
 * 2D scanner …). By design this plugin never reads or returns the device
 * model, manufacturer or any other hardware name: RakenOS enables features
 * from capabilities only.
 */
public class RakenSystem extends CordovaPlugin {
    private static final int REQ_CAMERA = 4701;
    private static final String[] SCANNER_PACKAGES = {
        "com.symbol.datawedge", "com.honeywell.decode", "com.honeywell.aidc",
        "com.datalogic.decodewedge", "com.sunmi.scanner", "com.android.scanner"
    };
    private CallbackContext permissionCallback;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext cb) throws JSONException {
        switch (action) {
            case "getCapabilities": cordova.getThreadPool().execute(() -> capabilities(cb)); return true;
            case "getBattery": battery(cb); return true;
            case "setBrightness": brightness((float) args.getDouble(0), cb); return true;
            case "setTorch": torch(args.getBoolean(0), cb); return true;
            case "vibrate": vibrate(args.optInt(0, 10), cb); return true;
            case "requestPermission": requestPermission(args.optString(0), cb); return true;
            case "openSystemSettings": openSettings(args.optString(0), cb); return true;
            case "openExternal": openExternal(args.getString(0), cb); return true;
            case "canRequestPackageInstalls": cb.success(canInstall() ? 1 : 0); return true;
            case "installPackage": {
                final String url = args.getString(0); final String sha = args.optString(1, "");
                cordova.getThreadPool().execute(() -> installPackage(url, sha, cb));
                return true;
            }
            default: return false;
        }
    }

    private Context ctx() { return cordova.getActivity().getApplicationContext(); }

    private void capabilities(CallbackContext cb) {
        try {
            PackageManager pm = ctx().getPackageManager();
            JSONObject o = new JSONObject();
            o.put("camera", pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY));
            o.put("torch", pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH));
            o.put("nfc", pm.hasSystemFeature(PackageManager.FEATURE_NFC));
            o.put("bluetooth", pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH));
            o.put("wifi", pm.hasSystemFeature(PackageManager.FEATURE_WIFI));
            o.put("telephony", pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY));
            o.put("fingerprint", pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT));
            o.put("gps", pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS));
            Vibrator v = (Vibrator) ctx().getSystemService(Context.VIBRATOR_SERVICE);
            o.put("vibration", v != null && v.hasVibrator());

            boolean multiple = false; boolean advanced = false;
            try {
                CameraManager cm = (CameraManager) ctx().getSystemService(Context.CAMERA_SERVICE);
                String[] ids = cm.getCameraIdList();
                multiple = ids.length > 1;
                for (String id : ids) {
                    CameraCharacteristics c = cm.getCameraCharacteristics(id);
                    Integer level = c.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL);
                    int[] caps = c.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
                    boolean manual = false;
                    if (caps != null) for (int cap : caps) if (cap == CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR) manual = true;
                    boolean full = level != null && (level == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL || level == CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3);
                    if (full && manual) advanced = true;
                }
            } catch (Exception ignored) { }
            o.put("multipleCameras", multiple);
            o.put("advancedCamera", advanced);

            // 2D scanner: a RakenOS system feature flag, or a built-in scanner service.
            boolean scanner = pm.hasSystemFeature("com.raken.hardware.scanner2d");
            for (String p : SCANNER_PACKAGES) {
                if (scanner) break;
                try { pm.getPackageInfo(p, 0); scanner = true; } catch (PackageManager.NameNotFoundException ignored) { }
            }
            o.put("scanner2d", scanner);
            cb.success(o);
        } catch (Exception e) { cb.error(e.getMessage()); }
    }

    private void battery(CallbackContext cb) {
        try {
            Intent i = ctx().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            int level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            int status = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            JSONObject o = new JSONObject();
            o.put("level", Math.round(level * 100f / Math.max(1, scale)));
            o.put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);
            o.put("source", "native");
            cb.success(o);
        } catch (Exception e) { cb.error(e.getMessage()); }
    }

    private void brightness(final float value, final CallbackContext cb) {
        cordova.getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams lp = cordova.getActivity().getWindow().getAttributes();
            lp.screenBrightness = Math.max(0.02f, Math.min(1f, value));
            cordova.getActivity().getWindow().setAttributes(lp);
            cb.success();
        });
    }

    private void torch(boolean on, CallbackContext cb) {
        try {
            CameraManager cm = (CameraManager) ctx().getSystemService(Context.CAMERA_SERVICE);
            for (String id : cm.getCameraIdList()) {
                Boolean flash = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (flash != null && flash) { cm.setTorchMode(id, on); cb.success(); return; }
            }
            cb.error("no-flash");
        } catch (Exception e) { cb.error(e.getMessage()); }
    }

    private void vibrate(int ms, CallbackContext cb) {
        Vibrator v = (Vibrator) ctx().getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) { cb.error("no-vibrator"); return; }
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), VibrationEffect.DEFAULT_AMPLITUDE));
        else v.vibrate(ms);
        cb.success();
    }

    private void requestPermission(String name, CallbackContext cb) {
        if (!"camera".equals(name)) { cb.success(1); return; }
        if (cordova.hasPermission(Manifest.permission.CAMERA)) { cb.success(1); return; }
        permissionCallback = cb;
        cordova.requestPermission(this, REQ_CAMERA, Manifest.permission.CAMERA);
    }

    @Override
    public void onRequestPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_CAMERA || permissionCallback == null) return;
        boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (ok) permissionCallback.success(1); else permissionCallback.error("denied");
        permissionCallback = null;
    }

    private void openSettings(String which, CallbackContext cb) {
        String action;
        switch (which) {
            case "wifi": action = Settings.ACTION_WIFI_SETTINGS; break;
            case "bluetooth": action = Settings.ACTION_BLUETOOTH_SETTINGS; break;
            case "nfc": action = Settings.ACTION_NFC_SETTINGS; break;
            case "install": action = Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES; break;
            default: action = Settings.ACTION_SETTINGS;
        }
        try {
            Intent i = new Intent(action);
            if ("install".equals(which)) i.setData(Uri.parse("package:" + ctx().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            cordova.getActivity().startActivity(i);
            cb.success();
        } catch (ActivityNotFoundException e) { cb.error("unavailable"); }
    }

    private void openExternal(String url, CallbackContext cb) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            cordova.getActivity().startActivity(i);
            cb.success();
        } catch (ActivityNotFoundException e) { cb.error("no-browser"); }
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || ctx().getPackageManager().canRequestPackageInstalls();
    }

    /**
     * Downloads an application package, verifies its SHA-256 digest and hands it
     * to the Android package installer. Android always shows its own
     * confirmation; RakenOS never installs an application package silently.
     */
    private void installPackage(String url, String expectedSha, CallbackContext cb) {
        try {
            if (!canInstall()) {
                openSettings("install", new CallbackContext("raken-install-settings", webView));
                cb.error("permission-required");
                return;
            }
            File dir = new File(ctx().getCacheDir(), "updates");
            if (!dir.exists() && !dir.mkdirs()) { cb.error("storage"); return; }
            File apk = new File(dir, "rakenos-update.apk");
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                byte[] buf = new byte[64 * 1024]; int n;
                while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); md.update(buf, 0, n); }
            } finally { c.disconnect(); }
            StringBuilder hex = new StringBuilder();
            for (byte b : md.digest()) hex.append(String.format("%02x", b));
            if (expectedSha != null && !expectedSha.isEmpty() && !expectedSha.equalsIgnoreCase(hex.toString())) {
                apk.delete();
                cb.error("verification-failed");
                return;
            }
            Uri uri = FileProvider.getUriForFile(ctx(), ctx().getPackageName() + ".raken.fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            cordova.getActivity().startActivity(i);
            cb.success("installer-opened");
        } catch (Exception e) { cb.error(e.getMessage()); }
    }
}
