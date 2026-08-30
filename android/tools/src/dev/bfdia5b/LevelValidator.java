package dev.bfdia5b;

import com.raken.bfdia5b.core.Level;
import com.raken.bfdia5b.core.Player;
import com.raken.bfdia5b.core.Tiles;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * A coarse "can this character get there at all" check for a level.
 *
 * <p>It floods the grid with an optimistic movement model - walk, jump up to
 * three tiles with a four tile reach, fall any distance, swim through the
 * liquid that character is immune to, and assume Firey has already burnt any
 * wood in the way. Being optimistic makes it a one-sided test: if it says a
 * character cannot reach the exit, the level really is broken.
 */
public final class LevelValidator {

    private static final int JUMP_UP = 2;   // a full jump clears 2.66 tiles, so two cells
    private static final int JUMP_REACH = 4;
    private static final int BOUNCE_UP = 6; // a trampoline throws you six
    private final Level level;
    /** With a crate to push around, any ledge is effectively one tile lower. */
    private final int crateBonus;

    public LevelValidator(Level level) {
        this.level = level;
        this.crateBonus = level.crateX.length > 0 ? 1 : 0;
    }

    public List<String> problems() {
        List<String> out = new ArrayList<>();
        if (countTiles(Tiles.EXIT) == 0) out.add("no exit tile ('E')");
        for (int c = 0; c < level.width; c++) {
            if (level.at(c, level.height - 1) == Tiles.EMPTY) {
                out.add("bottom row is open at column " + c + " (players would fall out)");
                break;
            }
        }
        if (level.keyCount == 0 && countTiles(Tiles.DOOR) > 0) {
            out.add("has a door but no key");
        }
        if (countTiles(Tiles.GATE) > 0 && countTiles(Tiles.BUTTON) == 0) {
            out.add("has a gate but no button");
        }
        checkReach(out, Player.FIREY, (int) level.fireyX, (int) level.fireyY);
        checkReach(out, Player.LEAFY, (int) level.leafyX, (int) level.leafyY);
        return out;
    }

    private void checkReach(List<String> out, int kind, int col, int row) {
        boolean[][] seen = flood(kind, col, row);
        boolean found = false;
        for (int r = 0; r < level.height && !found; r++) {
            for (int c = 0; c < level.width && !found; c++) {
                if (seen[r][c] && level.at(c, r) == Tiles.EXIT) found = true;
            }
        }
        if (!found) {
            out.add((kind == Player.FIREY ? "Firey" : "Leafy") + " cannot reach the exit");
        }
    }

    /** Cells this character can come to rest in. */
    public boolean[][] flood(int kind, int startCol, int startRow) {
        boolean[][] seen = new boolean[level.height][level.width];
        Deque<int[]> queue = new ArrayDeque<>();
        int[] start = settle(kind, startCol, startRow);
        if (start == null) return seen;
        seen[start[1]][start[0]] = true;
        queue.add(start);

        while (!queue.isEmpty()) {
            int[] cur = queue.poll();
            int c = cur[0], r = cur[1];
            if (swimmable(kind, c, r)) {
                offer(kind, seen, queue, c - 1, r);
                offer(kind, seen, queue, c + 1, r);
                offer(kind, seen, queue, c, r - 1);
                offer(kind, seen, queue, c, r + 1);
                continue;
            }
            offer(kind, seen, queue, c - 1, r);
            offer(kind, seen, queue, c + 1, r);
            int up = level.at(c, r + 1) == Tiles.TRAMPOLINE ? BOUNCE_UP : JUMP_UP + crateBonus;
            for (int dy = -up; dy <= 1; dy++) {
                for (int dx = -JUMP_REACH; dx <= JUMP_REACH; dx++) {
                    if (dx == 0 && dy == 0) continue;
                    int tc = c + dx, tr = r + dy;
                    if (blocked(kind, tc, tr)) continue;
                    if (!reachable(kind, c, r, tc, tr)) continue;
                    offer(kind, seen, queue, tc, tr);
                }
            }
        }
        return seen;
    }

    private void offer(int kind, boolean[][] seen, Deque<int[]> queue, int col, int row) {
        int[] rest = settle(kind, col, row);
        if (rest == null) return;
        if (seen[rest[1]][rest[0]]) return;
        seen[rest[1]][rest[0]] = true;
        queue.add(rest);
    }

    /** Falls from (col,row) to wherever the character would end up, or null if that kills them. */
    private int[] settle(int kind, int col, int row) {
        if (blocked(kind, col, row)) return null;
        int r = row;
        while (true) {
            if (r >= level.height) return null;                 // fell out of the level
            if (blocked(kind, col, r)) return null;
            if (swimmable(kind, col, r)) return new int[]{col, r};
            if (supported(kind, col, r)) return new int[]{col, r};
            r++;
        }
    }

    private boolean supported(int kind, int col, int row) {
        char below = level.at(col, row + 1);
        if (row + 1 >= level.height) return true;
        return Tiles.alwaysSolid(below) || Tiles.oneWay(below)
                || below == Tiles.DOOR || below == Tiles.GATE
                || swimmable(kind, col, row + 1);
    }

    private boolean blocked(int kind, int col, int row) {
        if (col < 0 || col >= level.width || row < 0) return true;
        if (row >= level.height) return true;
        char t = level.at(col, row);
        // Wood is assumed burnable, doors unlockable, gates openable.
        if (t == Tiles.BRICK || t == Tiles.ICE || t == Tiles.TRAMPOLINE) return true;
        if (t == Tiles.SPIKE) return true;
        if (kind == Player.FIREY && t == Tiles.WATER) return true;
        if (kind == Player.LEAFY && t == Tiles.LAVA) return true;
        return false;
    }

    private boolean swimmable(int kind, int col, int row) {
        char t = level.at(col, row);
        return kind == Player.FIREY ? t == Tiles.LAVA : t == Tiles.WATER;
    }

    /**
     * Stands in for a real jump arc: either the straight line to the target is
     * clear, or the character can go straight up and then across at the apex,
     * which is what landing on top of a ledge beside you actually looks like.
     */
    private boolean reachable(int kind, int c0, int r0, int c1, int r1) {
        if (clearLine(kind, c0, r0, c1, r1)) return true;
        if (r1 > r0) return false;                       // dropping needs no apex
        for (int r = r0 - 1; r >= r1; r--) {
            if (blocked(kind, c0, r)) return false;
        }
        int step = c1 > c0 ? 1 : -1;
        for (int c = c0 + step; c != c1 + step; c += step) {
            if (blocked(kind, c, r1)) return false;
        }
        return true;
    }

    /** Straight-line sight test, used as a stand-in for a real jump arc. */
    private boolean clearLine(int kind, int c0, int r0, int c1, int r1) {
        int dx = Math.abs(c1 - c0), sx = c0 < c1 ? 1 : -1;
        int dy = -Math.abs(r1 - r0), sy = r0 < r1 ? 1 : -1;
        int err = dx + dy;
        int c = c0, r = r0;
        while (true) {
            if (!(c == c0 && r == r0) && blocked(kind, c, r)) return false;
            if (c == c1 && r == r1) return true;
            int e2 = 2 * err;
            if (e2 >= dy) { err += dy; c += sx; }
            if (e2 <= dx) { err += dx; r += sy; }
        }
    }

    private int countTiles(char t) {
        int n = 0;
        for (int r = 0; r < level.height; r++) {
            for (int c = 0; c < level.width; c++) if (level.at(c, r) == t) n++;
        }
        return n;
    }
}
