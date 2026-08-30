package com.raken.bfdia5b.core;

/**
 * Tile ids used by the level format and the static properties of each id.
 *
 * <p>Anything that depends on run-time state (a door that is still locked, a
 * gate that is currently held open by a button) lives on {@link World} instead,
 * because the same id can be solid or not depending on the puzzle state.
 */
public final class Tiles {

    public static final char EMPTY = '.';
    public static final char BRICK = '#';
    public static final char PLATFORM = '=';
    public static final char WOOD = 'W';
    public static final char BURNING = 'b';
    public static final char WATER = '~';
    public static final char LAVA = '*';
    public static final char SPIKE = '^';
    public static final char ICE = 'I';
    public static final char DOOR = 'D';
    public static final char GATE = 'G';
    public static final char BUTTON = 'B';
    public static final char TRAMPOLINE = 'T';
    public static final char KEY = 'K';
    public static final char CAKE = 'o';
    public static final char EXIT = 'E';

    /** Spawn markers. They are replaced by {@link #EMPTY} while the level loads. */
    public static final char SPAWN_FIREY = 'F';
    public static final char SPAWN_LEAFY = 'L';
    public static final char SPAWN_CRATE = 'C';

    private Tiles() {
    }

    /** Solid regardless of puzzle state. Doors and gates are handled by World. */
    public static boolean alwaysSolid(char t) {
        return t == BRICK || t == WOOD || t == BURNING || t == ICE || t == TRAMPOLINE;
    }

    /** Solid only from above, and only for a body that is on its way down. */
    public static boolean oneWay(char t) {
        return t == PLATFORM;
    }

    public static boolean isLiquid(char t) {
        return t == WATER || t == LAVA;
    }

    /** Tiles a body simply passes through without any collision response. */
    public static boolean passable(char t) {
        return !alwaysSolid(t) && !oneWay(t) && t != DOOR && t != GATE;
    }

    public static boolean isKnown(char t) {
        switch (t) {
            case EMPTY: case BRICK: case PLATFORM: case WOOD: case BURNING:
            case WATER: case LAVA: case SPIKE: case ICE: case DOOR: case GATE:
            case BUTTON: case TRAMPOLINE: case KEY: case CAKE: case EXIT:
            case SPAWN_FIREY: case SPAWN_LEAFY: case SPAWN_CRATE:
                return true;
            default:
                return false;
        }
    }
}
