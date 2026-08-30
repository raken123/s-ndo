package com.raken.bfdia5b.core;

/** An axis-aligned box with velocity. Positions are in tiles, speeds in tiles/second. */
public class Body {

    public float x, y;      // top-left corner
    public float w, h;
    public float vx, vy;
    public boolean onGround;
    public boolean onIce;

    public Body(float x, float y, float w, float h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    public float right() {
        return x + w;
    }

    public float bottom() {
        return y + h;
    }

    public float centerX() {
        return x + w * 0.5f;
    }

    public float centerY() {
        return y + h * 0.5f;
    }

    public boolean overlaps(Body o) {
        return x < o.right() && right() > o.x && y < o.bottom() && bottom() > o.y;
    }

    /** True when this box overlaps tile (col, row) with a little slack taken off. */
    public boolean overlapsTile(int col, int row, float inset) {
        return x + inset < col + 1 && right() - inset > col
                && y + inset < row + 1 && bottom() - inset > row;
    }
}
