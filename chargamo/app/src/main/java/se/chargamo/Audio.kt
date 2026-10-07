package se.chargamo

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.util.Log
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/** Streams 16 kHz mono PCM from the microphone in 100 ms chunks. */
class MicStreamer(private val onPcm: (ByteArray) -> Unit) {
    @Volatile
    private var generation = 0

    @SuppressLint("MissingPermission")
    fun start() {
        val gen = ++generation
        Thread({ record(gen) }, "chargamo-mic").start()
    }

    fun stop() {
        generation++
    }

    @SuppressLint("MissingPermission")
    private fun record(gen: Int) {
        val minBuf = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val rec = try {
            AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                max(minBuf, CHUNK_BYTES) * 4,
            )
        } catch (e: Exception) {
            Log.w(TAG, "mic unavailable", e)
            return
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            rec.release()
            return
        }
        val aec = if (AcousticEchoCanceler.isAvailable()) AcousticEchoCanceler.create(rec.audioSessionId) else null
        aec?.setEnabled(true)
        val ns = if (NoiseSuppressor.isAvailable()) NoiseSuppressor.create(rec.audioSessionId) else null
        ns?.setEnabled(true)
        try {
            rec.startRecording()
            val buf = ByteArray(CHUNK_BYTES)
            while (gen == generation) {
                val n = rec.read(buf, 0, buf.size)
                if (n > 0 && gen == generation) onPcm(buf.copyOf(n))
            }
            rec.stop()
        } catch (e: Exception) {
            Log.w(TAG, "mic stopped", e)
        } finally {
            rec.release()
            aec?.release()
            ns?.release()
        }
    }

    companion object {
        private const val TAG = "MicStreamer"
        const val RATE = 16_000
        private const val CHUNK_BYTES = RATE / 10 * 2
    }
}

/** Plays the AI's 24 kHz mono PCM voice on the loudspeaker and reports its loudness. */
class SpeakerPlayer(private val onLevel: (Float) -> Unit) {
    private val queue = LinkedBlockingQueue<ByteArray>()
    private var track: AudioTrack? = null
    private var audioManager: AudioManager? = null

    @Volatile
    private var running = false

    fun start(context: Context) {
        val am = context.getSystemService(AudioManager::class.java)
        audioManager = am
        am.mode = AudioManager.MODE_IN_COMMUNICATION
        routeToSpeaker(am, true)

        val minBuf = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val t = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(max(minBuf * 2, RATE))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
        t.play()
        track = t
        running = true
        Thread({ loop(t) }, "chargamo-speaker").start()
    }

    fun play(pcm: ByteArray) {
        if (running) queue.offer(pcm)
    }

    /** The user interrupted the AI: drop what it was saying. */
    fun flush() {
        queue.clear()
        try {
            track?.let {
                it.pause()
                it.flush()
                it.play()
            }
        } catch (e: IllegalStateException) {
            Log.w(TAG, "flush", e)
        }
    }

    fun stop() {
        running = false
        queue.clear()
        track?.let {
            try {
                it.stop()
            } catch (e: IllegalStateException) {
            }
        }
        // The writer thread releases the track when it sees running == false.
        track = null
        audioManager?.let {
            routeToSpeaker(it, false)
            it.mode = AudioManager.MODE_NORMAL
        }
        audioManager = null
        onLevel(0f)
    }

    private fun loop(t: AudioTrack) {
        try {
            while (running) {
                val chunk = queue.poll(200, TimeUnit.MILLISECONDS)
                if (chunk == null) {
                    onLevel(0f)
                    continue
                }
                onLevel(level(chunk))
                t.write(chunk, 0, chunk.size)
            }
        } catch (e: InterruptedException) {
        } catch (e: IllegalStateException) {
            Log.w(TAG, "speaker stopped", e)
        } finally {
            t.release()
        }
    }

    private fun level(pcm: ByteArray): Float {
        var sum = 0.0
        val n = pcm.size / 2
        if (n == 0) return 0f
        for (i in 0 until n) {
            val s = ((pcm[2 * i + 1].toInt() shl 8) or (pcm[2 * i].toInt() and 0xff)).toShort() / 32768.0
            sum += s * s
        }
        return min(1f, (sqrt(sum / n) * 4).toFloat())
    }

    private fun routeToSpeaker(am: AudioManager, on: Boolean) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (on) {
                    am.availableCommunicationDevices
                        .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                        ?.let { am.setCommunicationDevice(it) }
                } else {
                    am.clearCommunicationDevice()
                }
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = on
            }
        } catch (e: Exception) {
            Log.w(TAG, "speaker routing", e)
        }
    }

    companion object {
        private const val TAG = "SpeakerPlayer"
        const val RATE = 24_000
    }
}
