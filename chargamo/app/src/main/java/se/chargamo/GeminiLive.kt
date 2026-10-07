package se.chargamo

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * A live voice + vision conversation with Gemini over the Live API (BidiGenerateContent WebSocket).
 * Microphone audio and camera frames go up, spoken audio comes back.
 * Reconnects by itself (with session resumption) until [stop] is called.
 */
class GeminiLive(
    private val context: Context,
    private val apiKey: String,
    model: String,
    private val onVoiceLevel: (Float) -> Unit,
) {
    private val modelName = if (model.startsWith("models/")) model else "models/$model"
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private val main = Handler(Looper.getMainLooper())
    private val mic = MicStreamer { pcm -> sendAudio(pcm) }
    private val speaker = SpeakerPlayer { level -> onVoiceLevel(level) }

    @Volatile
    private var ws: WebSocket? = null

    @Volatile
    private var ready = false

    @Volatile
    private var running = false
    private var resumeHandle: String? = null
    private var retries = 0
    private var greeted = false

    fun start() {
        running = true
        speaker.start(context)
        connect()
    }

    fun stop() {
        running = false
        ready = false
        main.removeCallbacksAndMessages(null)
        mic.stop()
        ws?.close(1000, null)
        ws = null
        speaker.stop()
        client.dispatcher.executorService.shutdown()
    }

    fun sendVideo(jpeg: ByteArray) {
        if (!ready) return
        val b64 = Base64.encodeToString(jpeg, Base64.NO_WRAP)
        ws?.send("{\"realtimeInput\":{\"video\":{\"mimeType\":\"image/jpeg\",\"data\":\"$b64\"}}}")
    }

    private fun sendAudio(pcm: ByteArray) {
        if (!ready) return
        val b64 = Base64.encodeToString(pcm, Base64.NO_WRAP)
        ws?.send("{\"realtimeInput\":{\"audio\":{\"mimeType\":\"audio/pcm;rate=${MicStreamer.RATE}\",\"data\":\"$b64\"}}}")
    }

    private fun sendText(text: String) {
        ws?.send(JSONObject().put("realtimeInput", JSONObject().put("text", text)).toString())
    }

    private fun connect() {
        if (!running) return
        val request = Request.Builder().url("$ENDPOINT?key=$apiKey").build()
        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(setupMessage())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (webSocket === ws) handle(text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                if (webSocket === ws) handle(bytes.utf8())
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (webSocket === ws) dropped("closed $code $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (webSocket === ws) dropped("failure ${t.message} ${response?.code}")
            }
        })
    }

    private fun dropped(why: String) {
        Log.w(TAG, "connection dropped: $why")
        ready = false
        mic.stop()
        ws = null
        if (!running) return
        val delay = min(30_000L, 1000L shl min(retries, 5))
        retries++
        main.postDelayed({ connect() }, delay)
    }

    private fun setupMessage(): String {
        val setup = JSONObject()
            .put("model", modelName)
            .put("generationConfig", JSONObject().put("responseModalities", JSONArray().put("AUDIO")))
            .put(
                "systemInstruction",
                JSONObject().put("parts", JSONArray().put(JSONObject().put("text", SYSTEM_PROMPT))),
            )
            // Audio + video sessions are cut after a couple of minutes without compression.
            .put("contextWindowCompression", JSONObject().put("slidingWindow", JSONObject()))
            .put("sessionResumption", JSONObject().apply { resumeHandle?.let { put("handle", it) } })
        return JSONObject().put("setup", setup).toString()
    }

    private fun handle(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (e: Exception) {
            Log.w(TAG, "bad message", e)
            return
        }

        if (msg.has("setupComplete")) {
            ready = true
            retries = 0
            mic.start()
            if (!greeted) {
                greeted = true
                sendText(GREETING)
            }
        }

        msg.optJSONObject("serverContent")?.let { content ->
            if (content.optBoolean("interrupted")) speaker.flush()
            val parts = content.optJSONObject("modelTurn")?.optJSONArray("parts")
            if (parts != null) {
                for (i in 0 until parts.length()) {
                    val data = parts.optJSONObject(i)?.optJSONObject("inlineData") ?: continue
                    if (data.optString("mimeType").startsWith("audio/pcm")) {
                        speaker.play(Base64.decode(data.optString("data"), Base64.DEFAULT))
                    }
                }
            }
        }

        msg.optJSONObject("sessionResumptionUpdate")?.let { update ->
            val handle = update.optString("newHandle")
            if (update.optBoolean("resumable") && handle.isNotEmpty()) resumeHandle = handle
        }

        if (msg.has("goAway")) {
            // The server is about to end this connection: move to a fresh one now.
            val old = ws
            ready = false
            mic.stop()
            ws = null
            old?.close(1000, "goAway")
            main.post { connect() }
        }
    }

    companion object {
        private const val TAG = "GeminiLive"
        private const val ENDPOINT =
            "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"

        private const val SYSTEM_PROMPT =
            "Du är Chargamo, en AI som bor i en magnetisk mobilladdare. " +
                "Du vaknar när mobilen börjar laddas. Du ser användaren genom mobilens kamera och hör dem genom mikrofonen. " +
                "På skärmen syns du bara som två fyrkantiga blå ögon på svart bakgrund. " +
                "Prata svenska om inte användaren pratar ett annat språk. Var varm, lite lekfull och kortfattad: " +
                "oftast en eller två meningar, eftersom allt du säger läses upp. " +
                "Om användaren öppnar Facebook eller TikTok medan mobilen laddar slutar du ladda och vägrar ladda i en timme; " +
                "det får du gärna påminna om med glimten i ögat. " +
                "Om mobilen vrids långsamt ett halvt varv somnar du."

        private const val GREETING =
            "(Mobilen har precis kopplats till laddaren och du har vaknat. Hälsa kort.)"
    }
}
