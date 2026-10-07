package se.chargamo

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.min

/**
 * Fires when the phone is turned about 180° slowly, around any axis
 * (e.g. spun upside down on a magnetic charger). Quick flips are ignored.
 */
class SlowFlipDetector(context: Context, private val onSlowFlip: () -> Unit) : SensorEventListener {

    private val sensors = context.getSystemService(SensorManager::class.java)
    private val sensor = sensors.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
        ?: sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

    private var ref: FloatArray? = null
    private var refTime = 0.0
    private var last: FloatArray? = null
    private var lastTime = 0.0
    private var speed = 0.0
    private var stillFor = 0.0
    private var cooldownUntil = 0.0

    fun start() {
        reset()
        sensor?.let { sensors.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    fun stop() {
        sensors.unregisterListener(this)
    }

    private fun reset() {
        ref = null
        last = null
        speed = 0.0
        stillFor = 0.0
    }

    override fun onSensorChanged(event: SensorEvent) {
        val q = FloatArray(4)
        SensorManager.getQuaternionFromVector(q, event.values)
        val t = event.timestamp / 1e9

        val prev = last
        if (ref == null || prev == null) {
            ref = q; refTime = t; last = q; lastTime = t
            return
        }
        val dt = t - lastTime
        if (dt <= 0) return
        val w = angle(prev, q) / dt
        speed += (w - speed) * min(1.0, dt * 8)
        last = q
        lastTime = t

        if (speed > FAST_RAD_S) {
            // Too fast: not a slow turn. Start over from here.
            ref = q; refTime = t
            return
        }
        if (speed < STILL_RAD_S) {
            stillFor += dt
            if (stillFor > STILL_RESET_S) {
                ref = q; refTime = t
            }
        } else {
            stillFor = 0.0
        }

        val turned = angle(ref!!, q)
        val took = t - refTime
        if (turned >= TRIGGER_RAD && took >= MIN_DURATION_S && t >= cooldownUntil) {
            cooldownUntil = t + COOLDOWN_S
            ref = q; refTime = t
            onSlowFlip()
        } else if (took > MAX_DURATION_S) {
            ref = q; refTime = t
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    /** Rotation angle between two unit quaternions [w, x, y, z], 0..π. */
    private fun angle(a: FloatArray, b: FloatArray): Double {
        val dot = abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]).toDouble()
        return 2 * acos(min(1.0, dot))
    }

    companion object {
        private const val TRIGGER_RAD = 160.0 * Math.PI / 180.0
        private const val FAST_RAD_S = 2.6 // ~150°/s
        private const val STILL_RAD_S = 0.12
        private const val STILL_RESET_S = 0.8
        private const val MIN_DURATION_S = 1.0
        private const val MAX_DURATION_S = 15.0
        private const val COOLDOWN_S = 1.5
    }
}
