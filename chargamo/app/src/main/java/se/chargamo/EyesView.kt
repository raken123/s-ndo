package se.chargamo

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.SystemClock
import android.view.View
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/** Two square blue eyes on black. Nothing else. */
class EyesView(context: Context) : View(context) {

    private val eyePaint = Paint().apply {
        color = context.getColor(R.color.eye_blue)
        style = Paint.Style.FILL
    }

    /** Eyes closed (sleep after a slow 180° turn). */
    var closed = false

    /** AI wants to talk but has no API key: eyes slowly look left and right. */
    var searching = false

    /** Loudness of the AI voice, 0..1. Makes the eyes pulse while it speaks. */
    @Volatile
    var voiceLevel = 0f

    private var lid = 1f // 1 open, 0 closed
    private var shownVoice = 0f
    private var lastFrame = 0L
    private var nextBlink = SystemClock.uptimeMillis() + 2500
    private val extraBlinks = ArrayDeque<Long>()

    init {
        setBackgroundColor(Color.BLACK)
    }

    fun blinkTwice() {
        val now = SystemClock.uptimeMillis()
        extraBlinks.addLast(now + 200)
        extraBlinks.addLast(now + 550)
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        val dt = if (lastFrame == 0L) 0f else min((now - lastFrame) / 1000f, 0.1f)
        lastFrame = now

        // Slow lids for falling asleep / waking up.
        val target = if (closed) 0f else 1f
        val lidSpeed = if (closed) 0.9f else 2.5f
        lid = if (lid < target) min(target, lid + lidSpeed * dt) else max(target, lid - lidSpeed * dt)

        // Quick blinks while awake.
        var blink = 1f
        if (!closed) {
            if (now > nextBlink + BLINK_MS) nextBlink = now + Random.nextLong(2500, 7000)
            while (extraBlinks.isNotEmpty() && now > extraBlinks.first() + BLINK_MS) extraBlinks.removeFirst()
            val blinkStart = extraBlinks.firstOrNull()?.takeIf { now >= it } ?: nextBlink
            val p = (now - blinkStart).toFloat() / BLINK_MS
            if (p in 0f..1f) blink = abs(1f - 2f * p)
        }

        shownVoice += (voiceLevel - shownVoice) * min(1f, dt * 14f)

        val w = width.toFloat()
        val h = height.toFloat()
        val size = min(w, h) * 0.24f * (1f + 0.12f * shownVoice)
        val gap = min(w, h) * 0.13f
        val gaze = if (searching && !closed) sin(now / 1000.0 * 2 * PI * 0.5).toFloat() * size * 0.35f else 0f
        val open = lid * blink
        val eyeH = max(size * open, size * 0.05f)
        val cx = w / 2f + gaze
        val cy = h / 2f

        eyePaint.alpha = (255 * (0.35f + 0.65f * lid)).toInt()
        canvas.drawRect(cx - gap / 2f - size, cy - eyeH / 2f, cx - gap / 2f, cy + eyeH / 2f, eyePaint)
        canvas.drawRect(cx + gap / 2f, cy - eyeH / 2f, cx + gap / 2f + size, cy + eyeH / 2f, eyePaint)

        postInvalidateOnAnimation()
    }

    companion object {
        private const val BLINK_MS = 180L
    }
}
