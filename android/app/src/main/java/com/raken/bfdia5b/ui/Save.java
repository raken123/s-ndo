package com.raken.bfdia5b.ui;

import android.content.Context;
import android.content.SharedPreferences;

/** Campaign progress: which levels are unlocked, and the best run of each. */
final class Save {

    private static final String FILE = "bfdia5b";
    private static final String UNLOCKED = "unlocked";
    private static final String CAKES = "cakes_";
    private static final String BEST_TIME = "time_";
    private static final String MUTED = "muted";

    private final SharedPreferences prefs;

    Save(Context context) {
        prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    /** How many levels the player may pick from; level 1 is always available. */
    int unlockedCount() {
        return Math.max(1, prefs.getInt(UNLOCKED, 1));
    }

    void unlockUpTo(int levelCount) {
        if (levelCount > unlockedCount()) {
            prefs.edit().putInt(UNLOCKED, levelCount).apply();
        }
    }

    int cakes(int index) {
        return prefs.getInt(CAKES + index, 0);
    }

    float bestTime(int index) {
        return prefs.getFloat(BEST_TIME + index, 0f);
    }

    boolean isCleared(int index) {
        return prefs.getFloat(BEST_TIME + index, 0f) > 0f;
    }

    /** Keeps the best of each stat rather than the most recent. */
    void recordClear(int index, int cakes, float seconds) {
        SharedPreferences.Editor editor = prefs.edit();
        if (cakes > cakes(index)) editor.putInt(CAKES + index, cakes);
        float best = bestTime(index);
        if (best <= 0f || seconds < best) editor.putFloat(BEST_TIME + index, seconds);
        editor.apply();
    }

    boolean isMuted() {
        return prefs.getBoolean(MUTED, false);
    }

    void setMuted(boolean muted) {
        prefs.edit().putBoolean(MUTED, muted).apply();
    }
}
