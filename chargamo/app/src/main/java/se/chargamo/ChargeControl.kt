package se.chargamo

import android.util.Log
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Switches charging on and off through the kernel's charger control files.
 *
 * Android has no public API for stopping charging, so this needs root (su).
 * Without root every call simply fails and returns false.
 */
object ChargeControl {
    private const val TAG = "ChargeControl"

    private class Node(val path: String, val on: String, val off: String)

    // Known control files across Qualcomm, Samsung, OnePlus, Pixel and MediaTek kernels.
    private val nodes = listOf(
        Node("/sys/class/power_supply/battery/charging_enabled", "1", "0"),
        Node("/sys/class/power_supply/battery/battery_charging_enabled", "1", "0"),
        Node("/sys/class/power_supply/battery/input_suspend", "0", "1"),
        Node("/sys/class/qcom-battery/input_suspend", "0", "1"),
        Node("/sys/class/power_supply/battery/charge_disable", "0", "1"),
        Node("/sys/class/power_supply/battery/op_disable_charge", "0", "1"),
        Node("/sys/class/power_supply/battery/batt_slate_mode", "0", "1"),
        Node("/sys/devices/platform/google,charger/charge_disable", "0", "1"),
        Node("/sys/kernel/debug/google_charger/chg_suspend", "0", "1"),
        Node("/proc/mtk_battery_cmd/current_cmd", "0 0", "0 1"),
    )

    private val executor = Executors.newSingleThreadExecutor()

    fun setChargingAsync(enabled: Boolean) {
        executor.execute { setCharging(enabled) }
    }

    fun setCharging(enabled: Boolean): Boolean {
        val script = nodes.joinToString("; ") { n ->
            val value = if (enabled) n.on else n.off
            "[ -e '${n.path}' ] && echo '$value' > '${n.path}'"
        } + "; true"
        return try {
            val p = ProcessBuilder("su", "-c", script).redirectErrorStream(true).start()
            if (!p.waitFor(8, TimeUnit.SECONDS)) {
                p.destroy()
                false
            } else {
                p.exitValue() == 0
            }
        } catch (e: Exception) {
            Log.i(TAG, "No root, cannot switch charging: ${e.message}")
            false
        }
    }
}
