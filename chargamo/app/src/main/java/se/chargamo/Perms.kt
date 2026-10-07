package se.chargamo

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings

object Perms {
    fun granted(c: Context, permission: String): Boolean =
        c.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    fun hasCameraAndMic(c: Context): Boolean =
        granted(c, Manifest.permission.CAMERA) && granted(c, Manifest.permission.RECORD_AUDIO)

    fun hasUsageAccess(c: Context): Boolean {
        val ops = c.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName)
        }
        return if (mode == AppOpsManager.MODE_DEFAULT) {
            granted(c, Manifest.permission.PACKAGE_USAGE_STATS)
        } else {
            mode == AppOpsManager.MODE_ALLOWED
        }
    }

    fun canDrawOverlays(c: Context): Boolean = Settings.canDrawOverlays(c)

    fun ignoresBatteryOptimizations(c: Context): Boolean =
        c.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(c.packageName)
}
