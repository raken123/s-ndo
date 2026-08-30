package com.raken.bfdia5b.ui;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

import com.raken.bfdia5b.core.Player;
import com.raken.bfdia5b.core.Tiles;

/**
 * Draws the cast and the scenery. Everything is vector work on the Canvas -
 * flat cartoon fills, one dark outline, no bitmaps anywhere.
 */
final class Art {

    // A warm storybook palette, the same one the launcher icon is painted in.
    static final int INK = 0xFF3A2A20;
    static final int CREAM = 0xFFF7E7C0;
    static final int CREAM_DEEP = 0xFFEFD49B;
    static final int BRICK = 0xFF9A6238;
    static final int BRICK_DARK = 0xFF6E4327;
    static final int BRICK_TOP = 0xFFB57C4C;
    static final int PLANK = 0xFFC79154;
    static final int WOOD = 0xFFAE7038;
    static final int WOOD_GRAIN = 0xFF8A5628;
    static final int WATER = 0xB43FAEE8;
    static final int WATER_DEEP = 0xC42B84C4;
    static final int LAVA = 0xFFF2652A;
    static final int LAVA_HOT = 0xFFFFB13C;
    static final int SPIKE = 0xFFC3CBD6;
    static final int SPIKE_DARK = 0xFF7C8798;
    static final int ICE = 0xCCBEE9FF;
    static final int DOOR_LOCKED = 0xFF8A5BD6;
    static final int GATE = 0xFF46B98F;
    static final int BUTTON_UP = 0xFFE0563F;
    static final int BUTTON_DOWN = 0xFFA83B2B;
    static final int TRAMPOLINE = 0xFFE86FA8;
    static final int KEY = 0xFFF5C542;
    static final int EXIT = 0xFF4E7BE8;
    static final int FIREY = 0xFFFF9A1F;
    static final int FIREY_HOT = 0xFFFFD84D;
    static final int LEAFY = 0xFF57BE2E;
    static final int LEAFY_LIGHT = 0xFF86DC58;
    static final int CAKE = 0xFFFFF0D2;
    static final int CAKE_ICING = 0xFFEE7FA8;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF rect = new RectF();

    Art() {
        fill.setStyle(Paint.Style.FILL);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeCap(Paint.Cap.ROUND);
        line.setStrokeJoin(Paint.Join.ROUND);
    }

    // ---------------------------------------------------------------- tiles

    /**
     * Draws one tile. {@code burn} is how much life a burning tile has left and
     * {@code phase} is a free-running clock used for the wobbling liquids.
     */
    void tile(Canvas canvas, char t, float x, float y, float size, float burn, float phase,
              boolean doorsLocked, boolean buttonHeld) {
        switch (t) {
            case Tiles.BRICK:
                brick(canvas, x, y, size);
                break;
            case Tiles.PLATFORM:
                plank(canvas, x, y, size);
                break;
            case Tiles.WOOD:
                wood(canvas, x, y, size);
                break;
            case Tiles.BURNING:
                wood(canvas, x, y, size);
                flames(canvas, x, y, size, burn, phase);
                break;
            case Tiles.WATER:
                liquid(canvas, x, y, size, phase, WATER, WATER_DEEP);
                break;
            case Tiles.LAVA:
                liquid(canvas, x, y, size, phase, LAVA, LAVA_HOT);
                break;
            case Tiles.SPIKE:
                spikes(canvas, x, y, size);
                break;
            case Tiles.ICE:
                ice(canvas, x, y, size);
                break;
            case Tiles.DOOR:
                door(canvas, x, y, size, doorsLocked);
                break;
            case Tiles.GATE:
                gate(canvas, x, y, size, buttonHeld);
                break;
            case Tiles.BUTTON:
                button(canvas, x, y, size, buttonHeld);
                break;
            case Tiles.TRAMPOLINE:
                trampoline(canvas, x, y, size);
                break;
            case Tiles.KEY:
                key(canvas, x + size / 2, y + size / 2, size * 0.36f, phase);
                break;
            case Tiles.CAKE:
                cake(canvas, x + size / 2, y + size * 0.82f, size * 0.72f, phase);
                break;
            case Tiles.EXIT:
                exit(canvas, x, y, size, phase);
                break;
            default:
                break;
        }
    }

    private void brick(Canvas canvas, float x, float y, float s) {
        rect.set(x, y, x + s, y + s);
        fill.setShader(null);
        fill.setColor(BRICK);
        canvas.drawRect(rect, fill);
        fill.setColor(BRICK_TOP);
        canvas.drawRect(x, y, x + s, y + s * 0.18f, fill);
        line.setColor(BRICK_DARK);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        canvas.drawRect(rect, line);
        canvas.drawLine(x, y + s * 0.55f, x + s, y + s * 0.55f, line);
    }

    private void plank(Canvas canvas, float x, float y, float s) {
        rect.set(x, y, x + s, y + s * 0.34f);
        fill.setShader(null);
        fill.setColor(PLANK);
        canvas.drawRoundRect(rect, s * 0.10f, s * 0.10f, fill);
        line.setColor(WOOD_GRAIN);
        line.setStrokeWidth(Math.max(1f, s * 0.045f));
        canvas.drawRoundRect(rect, s * 0.10f, s * 0.10f, line);
    }

    private void wood(Canvas canvas, float x, float y, float s) {
        rect.set(x, y, x + s, y + s);
        fill.setShader(null);
        fill.setColor(WOOD);
        canvas.drawRect(rect, fill);
        line.setColor(WOOD_GRAIN);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        canvas.drawRect(rect, line);
        canvas.drawLine(x + s * 0.2f, y + s * 0.3f, x + s * 0.8f, y + s * 0.3f, line);
        canvas.drawLine(x + s * 0.2f, y + s * 0.7f, x + s * 0.8f, y + s * 0.7f, line);
    }

    private void liquid(Canvas canvas, float x, float y, float s, float phase, int top, int deep) {
        fill.setShader(null);
        fill.setColor(deep);
        canvas.drawRect(x, y, x + s, y + s, fill);
        fill.setColor(top);
        float wave = (float) Math.sin(phase * 2.4 + x * 0.35) * s * 0.09f;
        canvas.drawRect(x, y + s * 0.14f + wave, x + s, y + s, fill);
        fill.setColor(0x40FFFFFF);
        canvas.drawRect(x, y + s * 0.14f + wave, x + s, y + s * 0.26f + wave, fill);
    }

    private void spikes(Canvas canvas, float x, float y, float s) {
        fill.setShader(null);
        fill.setColor(SPIKE_DARK);
        canvas.drawRect(x, y + s * 0.82f, x + s, y + s, fill);
        fill.setColor(SPIKE);
        for (int i = 0; i < 3; i++) {
            float left = x + s * (i / 3f);
            path.reset();
            path.moveTo(left, y + s * 0.88f);
            path.lineTo(left + s / 6f, y + s * 0.16f);
            path.lineTo(left + s / 3f, y + s * 0.88f);
            path.close();
            canvas.drawPath(path, fill);
        }
        line.setColor(SPIKE_DARK);
        line.setStrokeWidth(Math.max(1f, s * 0.04f));
        canvas.drawLine(x, y + s * 0.86f, x + s, y + s * 0.86f, line);
    }

    private void ice(Canvas canvas, float x, float y, float s) {
        rect.set(x, y, x + s, y + s);
        fill.setShader(null);
        fill.setColor(ICE);
        canvas.drawRect(rect, fill);
        line.setColor(0xFF8FD4F5);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        canvas.drawRect(rect, line);
        line.setColor(0x99FFFFFF);
        canvas.drawLine(x + s * 0.15f, y + s * 0.7f, x + s * 0.55f, y + s * 0.2f, line);
    }

    private void door(Canvas canvas, float x, float y, float s, boolean locked) {
        rect.set(x + s * 0.06f, y, x + s * 0.94f, y + s);
        fill.setShader(null);
        fill.setColor(locked ? DOOR_LOCKED : (DOOR_LOCKED & 0x30FFFFFF));
        canvas.drawRect(rect, fill);
        line.setColor(locked ? INK : 0x403A2A20);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        canvas.drawRect(rect, line);
        if (locked) {
            fill.setColor(KEY);
            canvas.drawCircle(x + s * 0.5f, y + s * 0.5f, s * 0.13f, fill);
        }
    }

    private void gate(Canvas canvas, float x, float y, float s, boolean open) {
        line.setStrokeWidth(Math.max(1.5f, s * 0.12f));
        line.setColor(open ? 0x3346B98F : GATE);
        for (int i = 0; i < 3; i++) {
            float bx = x + s * (0.22f + i * 0.28f);
            canvas.drawLine(bx, open ? y + s * 0.72f : y, bx, y + s, line);
        }
        line.setColor(open ? 0x3346B98F : 0xFF2E8567);
        line.setStrokeWidth(Math.max(1f, s * 0.06f));
        canvas.drawLine(x, y + s * 0.02f, x + s, y + s * 0.02f, line);
    }

    private void button(Canvas canvas, float x, float y, float s, boolean pressed) {
        fill.setShader(null);
        fill.setColor(INK);
        canvas.drawRect(x + s * 0.3f, y + s * 0.72f, x + s * 0.7f, y + s, fill);
        fill.setColor(pressed ? BUTTON_DOWN : BUTTON_UP);
        float top = pressed ? y + s * 0.78f : y + s * 0.58f;
        rect.set(x + s * 0.08f, top, x + s * 0.92f, top + s * 0.2f);
        canvas.drawRoundRect(rect, s * 0.09f, s * 0.09f, fill);
    }

    private void trampoline(Canvas canvas, float x, float y, float s) {
        fill.setShader(null);
        fill.setColor(INK);
        canvas.drawRect(x + s * 0.18f, y + s * 0.45f, x + s * 0.82f, y + s, fill);
        fill.setColor(TRAMPOLINE);
        rect.set(x + s * 0.02f, y + s * 0.24f, x + s * 0.98f, y + s * 0.52f);
        canvas.drawRoundRect(rect, s * 0.14f, s * 0.14f, fill);
        fill.setColor(0x66FFFFFF);
        rect.set(x + s * 0.12f, y + s * 0.28f, x + s * 0.88f, y + s * 0.36f);
        canvas.drawRoundRect(rect, s * 0.05f, s * 0.05f, fill);
    }

    void key(Canvas canvas, float cx, float cy, float r, float phase) {
        float bob = (float) Math.sin(phase * 3.0) * r * 0.12f;
        fill.setShader(null);
        fill.setColor(KEY);
        canvas.drawCircle(cx - r * 0.35f, cy + bob, r * 0.52f, fill);
        canvas.drawRect(cx - r * 0.1f, cy - r * 0.16f + bob, cx + r, cy + r * 0.16f + bob, fill);
        canvas.drawRect(cx + r * 0.55f, cy + bob, cx + r * 0.72f, cy + r * 0.6f + bob, fill);
        fill.setColor(CREAM);
        canvas.drawCircle(cx - r * 0.35f, cy + bob, r * 0.2f, fill);
    }

    void cake(Canvas canvas, float cx, float bottom, float s, float phase) {
        float bob = (float) Math.sin(phase * 2.6) * s * 0.06f;
        float b = bottom + bob;
        fill.setShader(null);
        fill.setColor(CAKE);
        rect.set(cx - s * 0.34f, b - s * 0.34f, cx + s * 0.34f, b);
        canvas.drawRoundRect(rect, s * 0.06f, s * 0.06f, fill);
        fill.setColor(CAKE_ICING);
        rect.set(cx - s * 0.38f, b - s * 0.52f, cx + s * 0.38f, b - s * 0.28f);
        canvas.drawRoundRect(rect, s * 0.08f, s * 0.08f, fill);
        fill.setColor(0xFFE04C4C);
        canvas.drawCircle(cx, b - s * 0.58f, s * 0.09f, fill);
        line.setColor(INK);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        rect.set(cx - s * 0.34f, b - s * 0.34f, cx + s * 0.34f, b);
        canvas.drawRoundRect(rect, s * 0.06f, s * 0.06f, line);
    }

    private void exit(Canvas canvas, float x, float y, float s, float phase) {
        float glow = 0.5f + 0.5f * (float) Math.sin(phase * 2.2);
        fill.setShader(null);
        fill.setColor(Color.argb((int) (70 + 60 * glow), 255, 240, 160));
        canvas.drawCircle(x + s * 0.5f, y + s * 0.5f, s * 0.72f, fill);
        rect.set(x + s * 0.06f, y, x + s * 0.94f, y + s);
        fill.setColor(EXIT);
        canvas.drawRect(rect, fill);
        fill.setColor(0x33FFFFFF);
        canvas.drawRect(x + s * 0.06f, y, x + s * 0.5f, y + s, fill);
        line.setColor(INK);
        line.setStrokeWidth(Math.max(1f, s * 0.05f));
        canvas.drawRect(rect, line);
    }

    private void flames(Canvas canvas, float x, float y, float s, float burn, float phase) {
        float life = Math.max(0.15f, Math.min(1f, burn));
        for (int i = 0; i < 3; i++) {
            float fx = x + s * (0.22f + i * 0.28f);
            float wobble = (float) Math.sin(phase * 9 + i * 2.1) * s * 0.09f;
            float height = s * (0.5f + 0.42f * life) * (0.75f + 0.25f * (i % 2));
            path.reset();
            path.moveTo(fx - s * 0.16f, y + s * 0.1f);
            path.quadTo(fx + wobble, y - height * 0.6f, fx + wobble * 0.4f, y - height);
            path.quadTo(fx + s * 0.2f + wobble, y - height * 0.4f, fx + s * 0.16f, y + s * 0.1f);
            path.close();
            fill.setShader(null);
            fill.setColor(i == 1 ? FIREY_HOT : FIREY);
            canvas.drawPath(path, fill);
        }
    }

    // ------------------------------------------------------------ the cast

    /** Draws Firey or Leafy with their box at (x, y, w, h) in screen pixels. */
    void character(Canvas canvas, int kind, float x, float y, float w, float h,
                   int facing, float animTime, boolean walking, boolean gliding, boolean alive) {
        float cx = x + w / 2;
        float bottom = y + h;
        float step = walking ? (float) Math.sin(animTime * 14) : 0;
        float bob = walking ? Math.abs(step) * h * 0.03f : (float) Math.sin(animTime * 2.4) * h * 0.02f;
        float bodyBottom = bottom - h * 0.16f - bob;

        limbs(canvas, cx, bodyBottom, bottom, w, h, step, gliding);
        if (kind == Player.FIREY) {
            fireyBody(canvas, cx, bodyBottom, w, h);
        } else {
            leafyBody(canvas, cx, bodyBottom, w, h);
        }
        face(canvas, cx, bodyBottom, w, h, facing, alive);
    }

    private void fireyBody(Canvas canvas, float cx, float bottom, float w, float h) {
        float bw = w * 1.02f, bh = h * 0.86f;
        float l = cx - bw / 2, r = cx + bw / 2;
        path.reset();
        path.moveTo(l, bottom - bh * 0.18f);
        path.quadTo(l, bottom, l + bw * 0.28f, bottom);
        path.lineTo(r - bw * 0.28f, bottom);
        path.quadTo(r, bottom, r, bottom - bh * 0.18f);
        path.lineTo(r, bottom - bh * 0.54f);
        path.lineTo(l + bw * 0.80f, bottom - bh * 0.88f);
        path.lineTo(l + bw * 0.64f, bottom - bh * 0.60f);
        path.lineTo(l + bw * 0.48f, bottom - bh * 1.06f);
        path.lineTo(l + bw * 0.32f, bottom - bh * 0.60f);
        path.lineTo(l + bw * 0.18f, bottom - bh * 0.86f);
        path.lineTo(l, bottom - bh * 0.52f);
        path.close();
        fill.setShader(null);
        fill.setColor(FIREY);
        canvas.drawPath(path, fill);
        line.setColor(0xFFE07A12);
        line.setStrokeWidth(Math.max(1.2f, w * 0.07f));
        canvas.drawPath(path, line);
        // The same flame again, smaller, for the hot core the icon has.
        canvas.save();
        canvas.scale(0.60f, 0.60f, cx, bottom - bh * 0.22f);
        fill.setColor(FIREY_HOT);
        canvas.drawPath(path, fill);
        canvas.restore();
    }

    private void leafyBody(Canvas canvas, float cx, float bottom, float w, float h) {
        float bw = w * 1.04f, bh = h * 0.92f;
        float top = bottom - bh;
        float l = cx - bw / 2, r = cx + bw / 2;
        path.reset();
        path.moveTo(cx, top);
        path.cubicTo(r, top + bh * 0.26f, r, bottom - bh * 0.22f, cx, bottom);
        path.cubicTo(l, bottom - bh * 0.22f, l, top + bh * 0.26f, cx, top);
        path.close();
        fill.setShader(null);
        fill.setColor(LEAFY);
        canvas.drawPath(path, fill);
        canvas.save();
        canvas.scale(0.72f, 0.86f, cx, bottom - bh * 0.5f);
        fill.setColor(LEAFY_LIGHT);
        canvas.drawPath(path, fill);
        canvas.restore();
        line.setColor(0xFF3E9420);
        line.setStrokeWidth(Math.max(1.2f, w * 0.07f));
        canvas.drawPath(path, line);
        line.setColor(0x66FFFFFF);
        line.setStrokeWidth(Math.max(1f, w * 0.05f));
        canvas.drawLine(cx, top + bh * 0.12f, cx, bottom - bh * 0.1f, line);
    }

    private void limbs(Canvas canvas, float cx, float bodyBottom, float feet, float w, float h,
                       float step, boolean gliding) {
        line.setColor(INK);
        line.setStrokeWidth(Math.max(1.4f, w * 0.09f));
        float legSpread = w * 0.22f;
        float swing = step * w * 0.34f;
        canvas.drawLine(cx - legSpread, bodyBottom - h * 0.05f, cx - legSpread - swing, feet, line);
        canvas.drawLine(cx + legSpread, bodyBottom - h * 0.05f, cx + legSpread + swing, feet, line);
        fill.setShader(null);
        fill.setColor(INK);
        canvas.drawCircle(cx - legSpread - swing, feet, w * 0.10f, fill);
        canvas.drawCircle(cx + legSpread + swing, feet, w * 0.10f, fill);

        float armY = bodyBottom - h * 0.42f;
        float armDrop = gliding ? -h * 0.22f : h * 0.16f;
        canvas.drawLine(cx - w * 0.34f, armY, cx - w * 0.62f, armY + armDrop, line);
        canvas.drawLine(cx + w * 0.34f, armY, cx + w * 0.62f, armY + armDrop, line);
        canvas.drawCircle(cx - w * 0.62f, armY + armDrop, w * 0.10f, fill);
        canvas.drawCircle(cx + w * 0.62f, armY + armDrop, w * 0.10f, fill);
    }

    private void face(Canvas canvas, float cx, float bottom, float w, float h,
                      int facing, boolean alive) {
        float eyeY = bottom - h * 0.52f;
        float dx = w * 0.19f + facing * w * 0.03f;
        fill.setShader(null);
        fill.setColor(INK);
        if (alive) {
            canvas.drawOval(rectOf(cx - dx - w * 0.09f, eyeY - h * 0.11f,
                    cx - dx + w * 0.09f, eyeY + h * 0.11f), fill);
            canvas.drawOval(rectOf(cx + dx - w * 0.09f, eyeY - h * 0.11f,
                    cx + dx + w * 0.09f, eyeY + h * 0.11f), fill);
            rect.set(cx - w * 0.20f, eyeY + h * 0.10f, cx + w * 0.20f, eyeY + h * 0.34f);
            canvas.drawArc(rect, 12, 156, true, fill);
        } else {
            line.setColor(INK);
            line.setStrokeWidth(Math.max(1.4f, w * 0.08f));
            cross(canvas, cx - dx, eyeY, w * 0.10f);
            cross(canvas, cx + dx, eyeY, w * 0.10f);
        }
    }

    private void cross(Canvas canvas, float cx, float cy, float r) {
        canvas.drawLine(cx - r, cy - r, cx + r, cy + r, line);
        canvas.drawLine(cx + r, cy - r, cx - r, cy + r, line);
    }

    /** Small portrait used by the swap button and the level-select cards. */
    void portrait(Canvas canvas, int kind, float cx, float cy, float size) {
        character(canvas, kind, cx - size * 0.36f, cy - size * 0.46f,
                size * 0.72f, size * 0.92f, 1, 0f, false, false, true);
    }

    void crate(Canvas canvas, float x, float y, float s) {
        rect.set(x, y, x + s, y + s);
        fill.setShader(null);
        fill.setColor(PLANK);
        canvas.drawRoundRect(rect, s * 0.10f, s * 0.10f, fill);
        line.setColor(WOOD_GRAIN);
        line.setStrokeWidth(Math.max(1.2f, s * 0.07f));
        canvas.drawRoundRect(rect, s * 0.10f, s * 0.10f, line);
        canvas.drawLine(x + s * 0.12f, y + s * 0.12f, x + s * 0.88f, y + s * 0.88f, line);
        canvas.drawLine(x + s * 0.88f, y + s * 0.12f, x + s * 0.12f, y + s * 0.88f, line);
    }

    private RectF rectOf(float l, float t, float r, float b) {
        rect.set(l, t, r, b);
        return rect;
    }
}
