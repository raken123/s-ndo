package com.raken.bfdia5b.ui;

import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;

/**
 * Every sound in the game is a few hundred milliseconds of PCM generated at
 * startup, which keeps the APK free of audio assets.
 */
final class Sfx {

    static final int JUMP = 0;
    static final int SWAP = 1;
    static final int PICKUP = 2;
    static final int DEATH = 3;
    static final int BOUNCE = 4;
    static final int WIN = 5;
    static final int BURN = 6;
    private static final int COUNT = 7;

    private static final int RATE = 22050;

    private final AudioTrack[] tracks = new AudioTrack[COUNT];
    private boolean available;
    private boolean muted;

    Sfx() {
        try {
            tracks[JUMP] = build(sweep(0.14f, 420, 780, 0.35f, true));
            tracks[SWAP] = build(sweep(0.10f, 620, 900, 0.28f, false));
            tracks[PICKUP] = build(chord(0.20f, new float[]{880, 1320}, 0.26f));
            tracks[DEATH] = build(sweep(0.42f, 420, 90, 0.32f, true));
            tracks[BOUNCE] = build(sweep(0.24f, 200, 720, 0.34f, true));
            tracks[WIN] = build(arpeggio(new float[]{523, 659, 784, 1046}, 0.11f, 0.28f));
            tracks[BURN] = build(noise(0.26f, 0.16f));
            available = true;
        } catch (Throwable ignored) {
            // A device that will not give us an AudioTrack simply plays silently.
            available = false;
        }
    }

    void setMuted(boolean muted) {
        this.muted = muted;
    }

    void play(int id) {
        if (!available || muted || id < 0 || id >= COUNT) return;
        AudioTrack track = tracks[id];
        if (track == null) return;
        try {
            track.stop();
            track.reloadStaticData();
            track.play();
        } catch (Throwable ignored) {
            // Never let a sound effect take the game down.
        }
    }

    void release() {
        for (int i = 0; i < COUNT; i++) {
            if (tracks[i] == null) continue;
            try {
                tracks[i].stop();
                tracks[i].release();
            } catch (Throwable ignored) {
                // Nothing useful to do while tearing down.
            }
            tracks[i] = null;
        }
        available = false;
    }

    private static AudioTrack build(short[] samples) {
        int bytes = samples.length * 2;
        AudioTrack track = new AudioTrack(AudioManager.STREAM_MUSIC, RATE,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
                bytes, AudioTrack.MODE_STATIC);
        track.write(samples, 0, samples.length);
        return track;
    }

    /** A tone sliding from one pitch to another, square-ish so it reads as chiptune. */
    private static short[] sweep(float seconds, float from, float to, float gain, boolean square) {
        int n = (int) (seconds * RATE);
        short[] out = new short[n];
        double phase = 0;
        for (int i = 0; i < n; i++) {
            float t = i / (float) n;
            double freq = from + (to - from) * t;
            phase += 2 * Math.PI * freq / RATE;
            double wave = square ? (Math.sin(phase) >= 0 ? 1 : -1) : Math.sin(phase);
            out[i] = (short) (wave * gain * envelope(t) * Short.MAX_VALUE);
        }
        return out;
    }

    private static short[] chord(float seconds, float[] freqs, float gain) {
        int n = (int) (seconds * RATE);
        short[] out = new short[n];
        for (int i = 0; i < n; i++) {
            float t = i / (float) n;
            double sum = 0;
            for (float f : freqs) sum += Math.sin(2 * Math.PI * f * i / RATE);
            sum /= freqs.length;
            out[i] = (short) (sum * gain * envelope(t) * Short.MAX_VALUE);
        }
        return out;
    }

    private static short[] arpeggio(float[] notes, float noteSeconds, float gain) {
        int per = (int) (noteSeconds * RATE);
        short[] out = new short[per * notes.length];
        for (int note = 0; note < notes.length; note++) {
            for (int i = 0; i < per; i++) {
                float t = i / (float) per;
                double wave = Math.sin(2 * Math.PI * notes[note] * i / RATE);
                out[note * per + i] = (short) (wave * gain * envelope(t) * Short.MAX_VALUE);
            }
        }
        return out;
    }

    private static short[] noise(float seconds, float gain) {
        int n = (int) (seconds * RATE);
        short[] out = new short[n];
        int seed = 0x5eed;
        for (int i = 0; i < n; i++) {
            seed = seed * 1103515245 + 12345;
            float t = i / (float) n;
            float value = ((seed >> 16) & 0x7fff) / 16384f - 1f;
            out[i] = (short) (value * gain * envelope(t) * Short.MAX_VALUE);
        }
        return out;
    }

    /** Quick attack, gentle decay - enough to stop every sound clicking. */
    private static float envelope(float t) {
        if (t < 0.02f) return t / 0.02f;
        return 1f - (t - 0.02f) / 0.98f;
    }
}
