package se.sando.tavla;

import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Mikrofon direkt via AudioRecord, som reserv när WebView svarar
 * NotReadableError ("Could not start audio source").
 *
 * WebView kan neka trots att appen har behörighet — ofta för att den
 * ljudkälla WebView väljer inte går att öppna på enheten. AudioRecord kan
 * däremot provas mot flera källor, och ljudet skickas vidare till webbappen
 * som 16 kHz PCM16 i base64.
 */
class NativeMic {

    /** Ljudkällor att prova i tur och ordning. */
    private static final int[] SOURCES = {
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.DEFAULT,
            MediaRecorder.AudioSource.CAMCORDER,
            MediaRecorder.AudioSource.VOICE_COMMUNICATION
    };
    private static final int RATE = 16000;
    private static final int CHUNK_SAMPLES = 3200;   /* 200 ms */

    private final Context context;
    private final WebView web;
    private AudioRecord record;
    private Thread thread;
    private volatile boolean running;
    private String activeSource = "";

    NativeMic(Context context, WebView web) {
        this.context = context;
        this.web = web;
    }

    boolean isRunning() {
        return running;
    }

    private boolean hasPermission() {
        return context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    private static String sourceName(int source) {
        if (source == MediaRecorder.AudioSource.MIC) return "MIC";
        if (source == MediaRecorder.AudioSource.VOICE_RECOGNITION) return "VOICE_RECOGNITION";
        if (source == MediaRecorder.AudioSource.DEFAULT) return "DEFAULT";
        if (source == MediaRecorder.AudioSource.CAMCORDER) return "CAMCORDER";
        if (source == MediaRecorder.AudioSource.VOICE_COMMUNICATION) return "VOICE_COMMUNICATION";
        return String.valueOf(source);
    }

    private static String deviceTypeName(int type) {
        if (type == AudioDeviceInfo.TYPE_BUILTIN_MIC) return "inbyggd mikrofon";
        if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET) return "headset";
        if (type == AudioDeviceInfo.TYPE_USB_DEVICE) return "USB";
        if (type == AudioDeviceInfo.TYPE_USB_HEADSET) return "USB-headset";
        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) return "Bluetooth";
        if (type == AudioDeviceInfo.TYPE_TELEPHONY) return "telefoni";
        if (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_REMOTE_SUBMIX) return "remote submix";
        return "typ " + type;
    }

    /** Vad enheten själv säger om mikrofonen — grunden för diagnosen. */
    String status() {
        JSONObject o = new JSONObject();
        try {
            o.put("permission", hasPermission() ? "granted" : "denied");
            o.put("hasMicFeature", context.getPackageManager()
                    .hasSystemFeature(PackageManager.FEATURE_MICROPHONE));
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            o.put("micMuted", am != null && am.isMicrophoneMute());
            o.put("audioMode", am == null ? -1 : am.getMode());
            if (am != null && Build.VERSION.SDK_INT >= 24) {
                o.put("otherAppsRecording", am.getActiveRecordingConfigurations().size());
                JSONArray devs = new JSONArray();
                for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
                    JSONObject j = new JSONObject();
                    j.put("type", deviceTypeName(d.getType()));
                    j.put("name", String.valueOf(d.getProductName()));
                    devs.put(j);
                }
                o.put("inputs", devs);
            }
            o.put("running", running);
            o.put("activeSource", activeSource);
            o.put("probe", probe());
        } catch (Exception e) {
            try { o.put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
        }
        return o.toString();
    }

    /** Provar varje ljudkälla och rapporterar vilka som går att öppna. */
    private JSONArray probe() {
        JSONArray out = new JSONArray();
        if (!hasPermission()) {
            out.put("saknar RECORD_AUDIO");
            return out;
        }
        if (running) {
            out.put("hoppar över test: native mikrofon är igång");
            return out;
        }
        for (int source : SOURCES) {
            AudioRecord r = null;
            try {
                int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT);
                if (min <= 0) {
                    out.put(sourceName(source) + ": buffertstorlek " + min);
                    continue;
                }
                r = new AudioRecord(source, RATE, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT, Math.max(min, CHUNK_SAMPLES * 4));
                if (r.getState() != AudioRecord.STATE_INITIALIZED) {
                    out.put(sourceName(source) + ": kunde inte initieras");
                    continue;
                }
                r.startRecording();
                boolean ok = r.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING;
                short[] buf = new short[CHUNK_SAMPLES];
                int read = ok ? r.read(buf, 0, buf.length) : -1;
                r.stop();
                out.put(sourceName(source) + ": " + (ok && read > 0
                        ? "OK (" + read + " sampel)"
                        : "startade inte (read=" + read + ")"));
            } catch (Exception e) {
                out.put(sourceName(source) + ": " + e.getClass().getSimpleName() +
                        (e.getMessage() != null ? " " + e.getMessage() : ""));
            } finally {
                if (r != null) {
                    try { r.release(); } catch (Exception ignored) { }
                }
            }
        }
        return out;
    }

    /** Startar inspelningen och matar webbappen med ljud. Returnerar "ok" eller ett fel. */
    String start() {
        if (running) return "ok";
        if (!hasPermission()) return "saknar behörighet till mikrofonen";
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null && am.isMicrophoneMute()) {
            try { am.setMicrophoneMute(false); } catch (Exception ignored) { }
        }
        String last = "okänt fel";
        for (int source : SOURCES) {
            try {
                int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT);
                if (min <= 0) { last = "buffertstorlek " + min; continue; }
                AudioRecord r = new AudioRecord(source, RATE, AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT, Math.max(min, CHUNK_SAMPLES * 4));
                if (r.getState() != AudioRecord.STATE_INITIALIZED) {
                    r.release();
                    last = sourceName(source) + " kunde inte initieras";
                    continue;
                }
                r.startRecording();
                if (r.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                    r.release();
                    last = sourceName(source) + " startade inte";
                    continue;
                }
                record = r;
                activeSource = sourceName(source);
                running = true;
                startReader();
                return "ok";
            } catch (Exception e) {
                last = sourceName(source) + ": " + e.getClass().getSimpleName();
            }
        }
        return last;
    }

    private void startReader() {
        thread = new Thread(new Runnable() {
            @Override
            public void run() {
                short[] buf = new short[CHUNK_SAMPLES];
                byte[] bytes = new byte[CHUNK_SAMPLES * 2];
                while (running && record != null) {
                    int read = record.read(buf, 0, buf.length);
                    if (read <= 0) {
                        continue;
                    }
                    for (int i = 0; i < read; i++) {
                        bytes[i * 2] = (byte) (buf[i] & 0xff);
                        bytes[i * 2 + 1] = (byte) ((buf[i] >> 8) & 0xff);
                    }
                    byte[] chunk = new byte[read * 2];
                    System.arraycopy(bytes, 0, chunk, 0, read * 2);
                    final String b64 = Base64.encodeToString(chunk, Base64.NO_WRAP);
                    web.post(new Runnable() {
                        @Override
                        public void run() {
                            web.evaluateJavascript(
                                    "window.__nativeAudio && window.__nativeAudio('" + b64 + "')", null);
                        }
                    });
                }
            }
        }, "sando-native-mic");
        thread.start();
    }

    void stop() {
        running = false;
        activeSource = "";
        Thread t = thread;
        thread = null;
        if (t != null) {
            try { t.join(500); } catch (InterruptedException ignored) { }
        }
        if (record != null) {
            try { record.stop(); } catch (Exception ignored) { }
            try { record.release(); } catch (Exception ignored) { }
            record = null;
        }
    }

    void unmute() {
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            try { am.setMicrophoneMute(false); } catch (Exception ignored) { }
        }
    }
}
