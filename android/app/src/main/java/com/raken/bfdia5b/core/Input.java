package com.raken.bfdia5b.core;

/** One frame of intent. The UI layer fills this in; the core never reads a device. */
public final class Input {

    public boolean left;
    public boolean right;
    public boolean down;
    public boolean jump;
    /** Edge-triggered: set for the single frame the swap was requested. */
    public boolean swap;

    public static final Input IDLE = new Input();

    public void clear() {
        left = right = down = jump = swap = false;
    }

    public void copyFrom(Input other) {
        left = other.left;
        right = other.right;
        down = other.down;
        jump = other.jump;
        swap = other.swap;
    }
}
