package com.raken.bfdia5b.core;

/**
 * Firey or Leafy.
 *
 * <p>The two differ only in what hurts them and in one movement trick each:
 * Firey sets wood alight and swims in lava, Leafy glides on a held jump and
 * swims in water.
 */
public final class Player extends Body {

    public static final int FIREY = 0;
    public static final int LEAFY = 1;

    public static final float WIDTH = 0.72f;
    public static final float HEIGHT = 0.92f;

    public final int kind;
    public boolean alive = true;
    public int facing = 1;

    /** Seconds of grace after walking off a ledge during which a jump still works. */
    public float coyote;
    /** Seconds a jump press stays queued while the player is still airborne. */
    public float jumpBuffer;
    public boolean jumpHeld;
    public boolean gliding;
    public boolean swimming;
    /** Drives the idle bob and the walk cycle in the renderer. */
    public float animTime;

    public Player(int kind, float col, float row) {
        super(col + (1 - WIDTH) / 2f, row + (1 - HEIGHT), WIDTH, HEIGHT);
        this.kind = kind;
    }

    public boolean isFirey() {
        return kind == FIREY;
    }

    /** Firey drowns in water, Leafy burns in lava and in burning wood. */
    public boolean killedBy(char tile) {
        if (tile == Tiles.SPIKE) return true;
        if (isFirey()) return tile == Tiles.WATER;
        return tile == Tiles.LAVA || tile == Tiles.BURNING;
    }

    /** The liquid this character can swim in instead of dying in it. */
    public char friendlyLiquid() {
        return isFirey() ? Tiles.LAVA : Tiles.WATER;
    }

    public String displayName() {
        return isFirey() ? "Firey" : "Leafy";
    }
}
