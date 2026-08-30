package com.raken.bfdia5b.core;

import java.util.ArrayList;
import java.util.List;

/**
 * One immutable level: the tile grid plus the spawn points pulled out of it.
 *
 * <p>A level is parsed from a small text block:
 *
 * <pre>
 * &#64;level Cave Entrance
 * &#64;hint Firey burns wood.
 * ##########
 * #F.....L.#
 * ##########
 * &#64;end
 * </pre>
 */
public final class Level {

    public final String name;
    public final String hint;
    public final int width;
    public final int height;

    /** Tiles, indexed [row][col]. Spawn markers are already replaced by empty. */
    private final char[][] grid;

    public final float fireyX, fireyY;
    public final float leafyX, leafyY;
    public final float[] crateX;
    public final float[] crateY;

    public final int cakeCount;
    public final int keyCount;

    private Level(String name, String hint, char[][] grid,
                  float fx, float fy, float lx, float ly,
                  List<int[]> crates) {
        this.name = name;
        this.hint = hint;
        this.grid = grid;
        this.height = grid.length;
        this.width = grid[0].length;
        this.fireyX = fx;
        this.fireyY = fy;
        this.leafyX = lx;
        this.leafyY = ly;
        this.crateX = new float[crates.size()];
        this.crateY = new float[crates.size()];
        for (int i = 0; i < crates.size(); i++) {
            crateX[i] = crates.get(i)[0];
            crateY[i] = crates.get(i)[1];
        }
        int cakes = 0, keys = 0;
        for (char[] row : grid) {
            for (char c : row) {
                if (c == Tiles.CAKE) cakes++;
                else if (c == Tiles.KEY) keys++;
            }
        }
        this.cakeCount = cakes;
        this.keyCount = keys;
    }

    public char at(int col, int row) {
        if (col < 0 || row < 0 || col >= width || row >= height) return Tiles.BRICK;
        return grid[row][col];
    }

    /** A mutable copy of the grid for a {@link World} to chew on. */
    public char[][] copyGrid() {
        char[][] copy = new char[height][];
        for (int r = 0; r < height; r++) copy[r] = grid[r].clone();
        return copy;
    }

    /**
     * Parses a level body. Lines starting with '@' are directives, everything
     * else is a row of tiles. Rows are padded to the width of the widest row.
     */
    public static Level parse(List<String> lines) {
        String name = "Untitled";
        String hint = "";
        List<String> rows = new ArrayList<>();
        for (String raw : lines) {
            if (raw.startsWith("@level")) {
                name = raw.substring("@level".length()).trim();
            } else if (raw.startsWith("@hint")) {
                hint = raw.substring("@hint".length()).trim();
            } else if (raw.startsWith("@") || raw.trim().isEmpty()) {
                // '@end' and blank separators carry no tiles.
            } else {
                rows.add(raw);
            }
        }
        if (rows.isEmpty()) throw new LevelFormatException(name + ": level has no rows");

        int w = 0;
        for (String r : rows) w = Math.max(w, r.length());
        char[][] grid = new char[rows.size()][w];

        float fx = -1, fy = -1, lx = -1, ly = -1;
        List<int[]> crates = new ArrayList<>();

        for (int r = 0; r < rows.size(); r++) {
            String row = rows.get(r);
            for (int c = 0; c < w; c++) {
                char t = c < row.length() ? row.charAt(c) : Tiles.EMPTY;
                if (t == ' ') t = Tiles.EMPTY;
                if (!Tiles.isKnown(t)) {
                    throw new LevelFormatException(
                            name + ": unknown tile '" + t + "' at column " + c + ", row " + r);
                }
                switch (t) {
                    case Tiles.SPAWN_FIREY:
                        fx = c; fy = r; t = Tiles.EMPTY;
                        break;
                    case Tiles.SPAWN_LEAFY:
                        lx = c; ly = r; t = Tiles.EMPTY;
                        break;
                    case Tiles.SPAWN_CRATE:
                        crates.add(new int[]{c, r}); t = Tiles.EMPTY;
                        break;
                    default:
                        break;
                }
                grid[r][c] = t;
            }
        }
        if (fx < 0) throw new LevelFormatException(name + ": no Firey spawn ('F')");
        if (lx < 0) throw new LevelFormatException(name + ": no Leafy spawn ('L')");
        return new Level(name, hint, grid, fx, fy, lx, ly, crates);
    }

    /** Thrown for a malformed level so a bad edit fails loudly instead of silently. */
    public static final class LevelFormatException extends RuntimeException {
        public LevelFormatException(String message) {
            super(message);
        }
    }
}
