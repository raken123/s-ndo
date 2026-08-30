package com.raken.bfdia5b.ui;

import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

import com.raken.bfdia5b.core.Crate;
import com.raken.bfdia5b.core.Level;
import com.raken.bfdia5b.core.Player;
import com.raken.bfdia5b.core.Tiles;
import com.raken.bfdia5b.core.World;

import java.util.List;

/** Puts the whole game on the screen: the level, the pad, the menus. */
final class Renderer {

    private final Art art = new Art();
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF rect = new RectF();

    /** Pixels per tile, the top-left corner of the view in tile space, and its size. */
    private float scale;
    private float camX, camY;
    private float viewTilesX, viewTilesY;

    private LinearGradient backdrop;
    private int backdropHeight;

    Renderer() {
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        text.setTextAlign(Paint.Align.LEFT);
    }

    // -------------------------------------------------------------- helpers

    private void background(Canvas canvas, int w, int h) {
        if (backdrop == null || backdropHeight != h) {
            backdrop = new LinearGradient(0, 0, 0, h, Art.CREAM, Art.CREAM_DEEP,
                    Shader.TileMode.CLAMP);
            backdropHeight = h;
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(backdrop);
        canvas.drawRect(0, 0, w, h, paint);
        paint.setShader(null);
    }

    private void label(Canvas canvas, String s, float x, float y, float size, int color,
                       Paint.Align align) {
        text.setTextAlign(align);
        text.setTextSize(size);
        text.setColor(0x33000000);
        canvas.drawText(s, x + size * 0.05f, y + size * 0.06f, text);
        text.setColor(color);
        canvas.drawText(s, x, y, text);
    }

    private void pill(Canvas canvas, RectF r, int color, float alpha) {
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(withAlpha(color, alpha));
        canvas.drawRoundRect(r, r.height() * 0.3f, r.height() * 0.3f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(Math.max(1.5f, r.height() * 0.06f));
        paint.setColor(withAlpha(Art.INK, alpha * 0.8f));
        canvas.drawRoundRect(r, r.height() * 0.3f, r.height() * 0.3f, paint);
        paint.setStyle(Paint.Style.FILL);
    }

    private static int withAlpha(int color, float alpha) {
        int a = (int) Math.max(0, Math.min(255, 255 * alpha));
        return (color & 0x00FFFFFF) | (a << 24);
    }

    // ---------------------------------------------------------------- title

    void drawTitle(Canvas canvas, Controls controls, float phase, int levelsCleared,
                   int levelCount) {
        int w = controls.width, h = controls.height;
        background(canvas, w, h);

        float t = h * 0.16f;
        label(canvas, "BFDIA", w / 2f, t, h * 0.20f, Art.FIREY, Paint.Align.CENTER);
        label(canvas, "5B", w / 2f, t + h * 0.19f, h * 0.20f, Art.LEAFY, Paint.Align.CENTER);

        float bob = (float) Math.sin(phase * 2.2) * h * 0.012f;
        art.portrait(canvas, Player.FIREY, w * 0.30f, h * 0.60f + bob, h * 0.30f);
        art.portrait(canvas, Player.LEAFY, w * 0.70f, h * 0.60f - bob, h * 0.30f);

        float alpha = 0.55f + 0.45f * (float) Math.abs(Math.sin(phase * 2.0));
        label(canvas, "TAP TO PLAY", w / 2f, h * 0.86f, h * 0.075f,
                withAlpha(Art.INK, alpha), Paint.Align.CENTER);
        label(canvas, levelsCleared + " / " + levelCount + " levels cleared",
                w / 2f, h * 0.95f, h * 0.045f, withAlpha(Art.INK, 0.6f), Paint.Align.CENTER);
    }

    // --------------------------------------------------------- level select

    void drawSelect(Canvas canvas, Controls controls, Save save, String[] names,
                    int unlocked, float phase) {
        int w = controls.width, h = controls.height;
        background(canvas, w, h);
        label(canvas, "CHOOSE A LEVEL", w / 2f, h * 0.16f, h * 0.10f, Art.INK, Paint.Align.CENTER);
        label(canvas, "Firey and Leafy both have to reach the door",
                w / 2f, h * 0.24f, h * 0.05f, withAlpha(Art.INK, 0.65f), Paint.Align.CENTER);

        for (int i = 0; i < controls.cardCount(); i++) {
            RectF r = controls.card(i);
            boolean open = i < unlocked;
            boolean cleared = save.isCleared(i);
            paint.setShader(null);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(open ? (cleared ? 0xFFFFF3D4 : 0xFFFFFFFF) : 0x33FFFFFF);
            canvas.drawRoundRect(r, r.width() * 0.12f, r.width() * 0.12f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(2f, r.width() * 0.035f));
            paint.setColor(open ? (cleared ? Art.LEAFY : Art.INK) : 0x553A2A20);
            canvas.drawRoundRect(r, r.width() * 0.12f, r.width() * 0.12f, paint);
            paint.setStyle(Paint.Style.FILL);

            if (open) {
                label(canvas, String.valueOf(i + 1), r.centerX(), r.top + r.height() * 0.42f,
                        r.height() * 0.34f, Art.INK, Paint.Align.CENTER);
                String name = i < names.length ? names[i] : "";
                label(canvas, name, r.centerX(), r.top + r.height() * 0.62f,
                        r.height() * 0.13f, withAlpha(Art.INK, 0.7f), Paint.Align.CENTER);
                if (cleared) {
                    art.cake(canvas, r.centerX() - r.width() * 0.16f, r.bottom - r.height() * 0.10f,
                            r.height() * 0.26f, phase);
                    label(canvas, "x" + save.cakes(i), r.centerX() + r.width() * 0.10f,
                            r.bottom - r.height() * 0.12f, r.height() * 0.16f, Art.INK,
                            Paint.Align.CENTER);
                }
            } else {
                lock(canvas, r.centerX(), r.centerY(), r.height() * 0.22f);
            }
        }
    }

    private void lock(Canvas canvas, float cx, float cy, float s) {
        paint.setColor(0x883A2A20);
        paint.setStyle(Paint.Style.FILL);
        rect.set(cx - s * 0.6f, cy - s * 0.1f, cx + s * 0.6f, cy + s * 0.75f);
        canvas.drawRoundRect(rect, s * 0.18f, s * 0.18f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(s * 0.22f);
        rect.set(cx - s * 0.36f, cy - s * 0.75f, cx + s * 0.36f, cy + s * 0.1f);
        canvas.drawArc(rect, 180, 180, false, paint);
        paint.setStyle(Paint.Style.FILL);
    }

    // ----------------------------------------------------------------- game

    void drawGame(Canvas canvas, World world, Controls controls, Save save, int levelIndex,
                  float phase, boolean muted) {
        int w = controls.width, h = controls.height;
        background(canvas, w, h);
        camera(world.level, world, w, h);

        canvas.save();
        canvas.translate(-camX * scale, -camY * scale);
        drawLevel(canvas, world, phase);
        canvas.restore();

        hud(canvas, world, controls, levelIndex, muted, phase);
        pad(canvas, world, controls);

        if (world.state == World.STATE_WON) {
            winOverlay(canvas, world, controls, save, levelIndex);
        } else if (world.state == World.STATE_DEAD) {
            deathFlash(canvas, world, w, h);
        }
    }

    private void camera(Level level, World world, int w, int h) {
        float fitAll = Math.min(w / (float) level.width, h / (float) level.height);
        float comfortable = h / 13f;
        scale = Math.max(fitAll, Math.min(comfortable, h / 9f));

        float viewW = w / scale, viewH = h / scale;
        viewTilesX = viewW;
        viewTilesY = viewH;
        Player p = world.activePlayer();
        camX = p.centerX() - viewW / 2;
        camY = p.centerY() - viewH / 2;
        camX = clamp(camX, 0, Math.max(0, level.width - viewW));
        camY = clamp(camY, 0, Math.max(0, level.height - viewH));
        if (viewW > level.width) camX = (level.width - viewW) / 2;
        if (viewH > level.height) camY = (level.height - viewH) / 2;
    }

    private void drawLevel(Canvas canvas, World world, float phase) {
        Level level = world.level;
        float s = scale;

        // The cave wall behind the level, so the play area reads as a room.
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0x22B07A45);
        canvas.drawRect(0, 0, level.width * s, level.height * s, paint);

        int c0 = (int) Math.max(0, Math.floor(camX) - 1);
        int r0 = (int) Math.max(0, Math.floor(camY) - 1);
        int c1 = (int) Math.min(level.width - 1, camX + viewTilesX + 1);
        int r1 = (int) Math.min(level.height - 1, camY + viewTilesY + 1);

        for (int r = r0; r <= r1; r++) {
            for (int c = c0; c <= c1; c++) {
                char t = world.tile(c, r);
                if (t == Tiles.EMPTY) continue;
                art.tile(canvas, t, c * s, r * s, s, world.burnAmount(c, r) / World.BURN_TIME,
                        phase, world.doorsLocked(), world.buttonPressed);
            }
        }

        List<Crate> crates = world.crates();
        for (int i = 0; i < crates.size(); i++) {
            Crate crate = crates.get(i);
            art.crate(canvas, crate.x * s, crate.y * s, crate.w * s);
        }

        drawPlayer(canvas, world, world.idlePlayer(), false);
        drawPlayer(canvas, world, world.activePlayer(), true);
    }

    private void drawPlayer(Canvas canvas, World world, Player p, boolean isActive) {
        float s = scale;
        if (isActive) {
            paint.setShader(null);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(withAlpha(p.isFirey() ? Art.FIREY : Art.LEAFY, 0.22f));
            canvas.drawCircle(p.centerX() * s, p.centerY() * s, s * 0.95f, paint);
        }
        boolean walking = p.onGround && Math.abs(p.vx) > 0.4f;
        art.character(canvas, p.kind, p.x * s, p.y * s, p.w * s, p.h * s,
                p.facing, p.animTime, walking, p.gliding, p.alive);
        if (!isActive && world.state == World.STATE_PLAYING) {
            // A little "zzz" marker so the idle one is easy to spot.
            label(canvas, "z", p.centerX() * s + s * 0.5f, p.y * s - s * 0.1f,
                    s * 0.45f, withAlpha(Art.INK, 0.5f), Paint.Align.CENTER);
        }
    }

    private void hud(Canvas canvas, World world, Controls controls, int levelIndex,
                     boolean muted, float phase) {
        int w = controls.width, h = controls.height;
        float size = h * 0.055f;
        label(canvas, (levelIndex + 1) + ". " + world.level.name, w * 0.02f, size * 1.5f,
                size, Art.INK, Paint.Align.LEFT);
        label(canvas, world.level.hint, w * 0.02f, size * 2.6f, size * 0.62f,
                withAlpha(Art.INK, 0.7f), Paint.Align.LEFT);

        float cakeX = w * 0.02f + size * 0.9f;
        art.cake(canvas, cakeX, h * 0.965f, size * 1.5f, phase);
        label(canvas, world.cakes + " / " + world.level.cakeCount, cakeX + size * 0.9f,
                h * 0.965f, size * 0.8f, Art.INK, Paint.Align.LEFT);

        if (world.level.keyCount > 0) {
            float keyX = cakeX + size * 4.2f;
            art.key(canvas, keyX, h * 0.945f, size * 0.7f, phase);
            label(canvas, world.keys + " / " + world.level.keyCount, keyX + size * 0.9f,
                    h * 0.965f, size * 0.8f, Art.INK, Paint.Align.LEFT);
        }

        iconButton(canvas, controls.restart, "↺");
        iconButton(canvas, controls.menu, "≡");
        iconButton(canvas, controls.mute, muted ? "✗" : "♪");
    }

    private void iconButton(Canvas canvas, RectF r, String glyph) {
        pill(canvas, r, 0xFFFFFFFF, 0.62f);
        label(canvas, glyph, r.centerX(), r.centerY() + r.height() * 0.30f,
                r.height() * 0.62f, Art.INK, Paint.Align.CENTER);
    }

    private void pad(Canvas canvas, World world, Controls controls) {
        arrowButton(canvas, controls.left, 180);
        arrowButton(canvas, controls.right, 0);
        arrowButton(canvas, controls.down, 90);

        pill(canvas, controls.jump, 0xFFFFD166, 0.80f);
        label(canvas, "JUMP", controls.jump.centerX(),
                controls.jump.centerY() + controls.jump.height() * 0.12f,
                controls.jump.height() * 0.26f, Art.INK, Paint.Align.CENTER);

        pill(canvas, controls.swap, 0xFFFFFFFF, 0.72f);
        Player next = world.idlePlayer();
        art.portrait(canvas, next.kind, controls.swap.centerX(),
                controls.swap.centerY() - controls.swap.height() * 0.06f,
                controls.swap.height() * 0.62f);
        label(canvas, "SWAP", controls.swap.centerX(),
                controls.swap.bottom - controls.swap.height() * 0.08f,
                controls.swap.height() * 0.18f, withAlpha(Art.INK, 0.8f), Paint.Align.CENTER);
    }

    private void arrowButton(Canvas canvas, RectF r, float degrees) {
        pill(canvas, r, 0xFFFFFFFF, 0.62f);
        float cx = r.centerX(), cy = r.centerY(), s = r.height() * 0.26f;
        canvas.save();
        canvas.rotate(degrees, cx, cy);
        path.reset();
        path.moveTo(cx - s * 0.5f, cy - s);
        path.lineTo(cx + s * 0.8f, cy);
        path.lineTo(cx - s * 0.5f, cy + s);
        path.close();
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Art.INK);
        canvas.drawPath(path, paint);
        canvas.restore();
    }

    private void deathFlash(Canvas canvas, World world, int w, int h) {
        float t = Math.min(1f, world.stateTimer / World.DEATH_PAUSE);
        paint.setShader(null);
        paint.setColor(withAlpha(0xFFE0563F, 0.35f * (1 - t)));
        canvas.drawRect(0, 0, w, h, paint);
        label(canvas, world.lastDeathCause, w / 2f, h * 0.42f, h * 0.07f,
                withAlpha(0xFF8A2B1E, 1f - t * 0.4f), Paint.Align.CENTER);
    }

    private void winOverlay(Canvas canvas, World world, Controls controls, Save save,
                            int levelIndex) {
        int w = controls.width, h = controls.height;
        paint.setShader(null);
        paint.setColor(withAlpha(0xFF2A1F18, 0.55f));
        canvas.drawRect(0, 0, w, h, paint);

        label(canvas, "LEVEL CLEAR!", w / 2f, h * 0.30f, h * 0.13f, 0xFFFFD166,
                Paint.Align.CENTER);
        label(canvas, "cakes " + world.cakes + " / " + world.level.cakeCount
                        + "     time " + formatTime(world.time)
                        + "     restarts " + world.deaths,
                w / 2f, h * 0.44f, h * 0.055f, 0xFFFFF3D4, Paint.Align.CENTER);
        float best = save.bestTime(levelIndex);
        if (best > 0) {
            label(canvas, "best " + formatTime(best), w / 2f, h * 0.52f, h * 0.045f,
                    0xCCFFF3D4, Paint.Align.CENTER);
        }

        boolean hasNext = levelIndex + 1 < controls.cardCount();
        if (hasNext) overlayButton(canvas, controls.overlayNext, "NEXT", 0xFF57BE2E);
        overlayButton(canvas, controls.overlayRetry, "RETRY", 0xFFFFD166);
        overlayButton(canvas, controls.overlayMenu, "LEVELS", 0xFFFFFFFF);
    }

    private void overlayButton(Canvas canvas, RectF r, String caption, int color) {
        pill(canvas, r, color, 0.95f);
        label(canvas, caption, r.centerX(), r.centerY() + r.height() * 0.14f,
                r.height() * 0.40f, Art.INK, Paint.Align.CENTER);
    }

    static String formatTime(float seconds) {
        int total = (int) seconds;
        return String.format("%d:%02d", total / 60, total % 60);
    }

    /** Shown while the level pack is still being read off disk. */
    void drawLoading(Canvas canvas, int w, int h, String message) {
        background(canvas, w, h);
        label(canvas, message, w / 2f, h / 2f, h * 0.06f, Art.INK, Paint.Align.CENTER);
    }

    private static float clamp(float value, float low, float high) {
        return value < low ? low : (value > high ? high : value);
    }
}
