package com.raken.bfdia5b.core;

/** A pushable block. Heavy enough to hold a button down, light enough to shove. */
public final class Crate extends Body {

    public static final float SIZE = 0.9f;

    public Crate(float col, float row) {
        super(col + (1 - SIZE) / 2f, row + (1 - SIZE), SIZE, SIZE);
    }
}
