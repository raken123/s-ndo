package se.chargamo

import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import kotlin.math.max

/** Sends roughly one JPEG per second from the front camera. Nothing is shown on screen. */
class CameraFeeder(
    private val activity: ComponentActivity,
    private val onJpeg: (ByteArray) -> Unit,
) {
    private val executor = Executors.newSingleThreadExecutor()
    private var provider: ProcessCameraProvider? = null

    @Volatile
    private var active = false
    private var lastSent = 0L

    fun start() {
        active = true
        val future = ProcessCameraProvider.getInstance(activity)
        future.addListener({
            if (!active) return@addListener
            try {
                val p = future.get()
                provider = p
                val analysis = ImageAnalysis.Builder()
                    .setResolutionSelector(
                        ResolutionSelector.Builder()
                            .setResolutionStrategy(
                                ResolutionStrategy(
                                    Size(640, 480),
                                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                                ),
                            )
                            .build(),
                    )
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                analysis.setAnalyzer(executor) { image -> analyze(image) }
                val selector = if (p.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                    CameraSelector.DEFAULT_FRONT_CAMERA
                } else {
                    CameraSelector.DEFAULT_BACK_CAMERA
                }
                p.unbindAll()
                p.bindToLifecycle(activity, selector, analysis)
            } catch (e: Exception) {
                Log.w(TAG, "camera unavailable", e)
            }
        }, ContextCompat.getMainExecutor(activity))
    }

    fun stop() {
        active = false
        provider?.unbindAll()
        provider = null
        executor.shutdown()
    }

    private fun analyze(image: ImageProxy) {
        try {
            val now = SystemClock.uptimeMillis()
            if (!active || now - lastSent < FRAME_INTERVAL_MS) return
            lastSent = now
            onJpeg(encode(image))
        } catch (e: Exception) {
            Log.w(TAG, "frame", e)
        } finally {
            image.close()
        }
    }

    private fun encode(image: ImageProxy): ByteArray {
        val src = image.toBitmap()
        val scale = MAX_SIDE.toFloat() / max(src.width, src.height)
        val m = Matrix().apply {
            if (scale < 1f) postScale(scale, scale)
            postRotate(image.imageInfo.rotationDegrees.toFloat())
        }
        val bmp = Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 70, out)
        if (bmp !== src) bmp.recycle()
        src.recycle()
        return out.toByteArray()
    }

    companion object {
        private const val TAG = "CameraFeeder"
        private const val FRAME_INTERVAL_MS = 1000L
        private const val MAX_SIDE = 640
    }
}
