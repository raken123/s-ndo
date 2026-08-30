package com.raken.bfdia5b.core;

import java.util.ArrayList;
import java.util.List;

/**
 * The whole simulation for one level: two characters, the pushable crates and
 * every tile that can change state (wood that burns, doors that unlock, gates
 * held open by a button).
 *
 * <p>Deliberately free of Android imports so it can be exercised head-less.
 */
public final class World {

    // --- movement tuning, all in tiles and seconds -----------------------
    public static final float GRAVITY = 48f;
    public static final float MOVE_SPEED = 7.2f;
    public static final float PUSH_SPEED = 3.4f;
    public static final float GROUND_ACCEL = 70f;
    public static final float AIR_ACCEL = 42f;
    public static final float ICE_ACCEL = 16f;
    public static final float GROUND_FRICTION = 62f;
    public static final float AIR_FRICTION = 14f;
    public static final float ICE_FRICTION = 4.5f;
    public static final float JUMP_SPEED = 16.2f;
    public static final float JUMP_CUT = 0.42f;
    public static final float MAX_FALL = 26f;
    public static final float GLIDE_GRAVITY = 0.32f;
    public static final float GLIDE_MAX_FALL = 3.6f;
    public static final float BOUNCE_SPEED = 24f;
    public static final float SWIM_GRAVITY = 0.20f;
    public static final float SWIM_SPEED = 4.2f;
    public static final float SWIM_RISE_ACCEL = 30f;
    public static final float SWIM_MAX_RISE = 4.6f;
    public static final float SWIM_MAX_SINK = 4.4f;
    public static final float SWIM_DRAG = 2.6f;
    public static final float COYOTE_TIME = 0.10f;
    public static final float JUMP_BUFFER_TIME = 0.13f;
    public static final float BURN_TIME = 1.15f;
    public static final float DEATH_PAUSE = 0.85f;

    private static final float EPS = 0.001f;
    private static final float HAZARD_INSET = 0.18f;
    private static final float PICKUP_INSET = 0.10f;
    private static final float EXIT_INSET = 0.22f;
    private static final float MAX_STEP = 1f / 120f;
    private static final int MAX_PUSH_DEPTH = 2;

    public static final int STATE_PLAYING = 0;
    public static final int STATE_DEAD = 1;
    public static final int STATE_WON = 2;

    public final Level level;
    private char[][] grid;
    private float[][] burn;
    private boolean[][] gateHeldOpen;

    public Player firey;
    public Player leafy;
    private final List<Crate> crates = new ArrayList<>();

    /** Which character the on-screen controls drive right now. */
    public int active = Player.FIREY;
    public int state = STATE_PLAYING;

    public int cakes;
    public int keys;
    public int deaths;
    public float time;
    public float stateTimer;
    /** Non-zero right after a death so the UI can flash the cause. */
    public String lastDeathCause = "";
    public boolean buttonPressed;
    /** Set for one frame when something happened worth a sound effect. */
    public boolean sfxJump, sfxSwap, sfxPickup, sfxDeath, sfxBounce, sfxWin, sfxBurn;

    /** Reused so a step never allocates. */
    private final Input sliceInput = new Input();

    public World(Level level) {
        this.level = level;
        reset(true);
    }

    /** Restarts the level. Deaths carry over unless this is the first load. */
    public void reset(boolean fresh) {
        grid = level.copyGrid();
        burn = new float[level.height][level.width];
        gateHeldOpen = new boolean[level.height][level.width];
        firey = new Player(Player.FIREY, level.fireyX, level.fireyY);
        leafy = new Player(Player.LEAFY, level.leafyX, level.leafyY);
        crates.clear();
        for (int i = 0; i < level.crateX.length; i++) {
            crates.add(new Crate(level.crateX[i], level.crateY[i]));
        }
        active = Player.FIREY;
        state = STATE_PLAYING;
        cakes = 0;
        keys = 0;
        stateTimer = 0;
        buttonPressed = false;
        lastDeathCause = "";
        if (fresh) {
            deaths = 0;
            time = 0;
        }
    }

    public List<Crate> crates() {
        return crates;
    }

    public Player activePlayer() {
        return active == Player.FIREY ? firey : leafy;
    }

    public Player idlePlayer() {
        return active == Player.FIREY ? leafy : firey;
    }

    public char tile(int col, int row) {
        if (col < 0 || col >= level.width || row < 0) return Tiles.BRICK;
        if (row >= level.height) return Tiles.EMPTY;   // the pit under the level
        return grid[row][col];
    }

    public float burnAmount(int col, int row) {
        if (col < 0 || col >= level.width || row < 0 || row >= level.height) return 0;
        return burn[row][col];
    }

    private void setTile(int col, int row, char t) {
        if (col < 0 || col >= level.width || row < 0 || row >= level.height) return;
        grid[row][col] = t;
    }

    public boolean doorsLocked() {
        return keys < level.keyCount;
    }

    /** Solid for collision purposes, taking doors, gates and buttons into account. */
    public boolean solidAt(int col, int row) {
        char t = tile(col, row);
        if (Tiles.alwaysSolid(t)) return true;
        if (t == Tiles.DOOR) return doorsLocked();
        if (t == Tiles.GATE) {
            if (buttonPressed) return false;
            if (row >= 0 && row < level.height && col >= 0 && col < level.width) {
                return !gateHeldOpen[row][col];
            }
            return true;
        }
        return false;
    }

    // ---------------------------------------------------------------- step

    /** Advances the simulation. Long frames are split so nothing tunnels. */
    public void step(float dt, Input in) {
        clearSfx();
        if (dt > 0.25f) dt = 0.25f;
        sliceInput.copyFrom(in);
        while (dt > 0) {
            float slice = Math.min(dt, MAX_STEP);
            substep(slice, sliceInput);
            // A swap must fire once per frame, not once per substep.
            sliceInput.swap = false;
            dt -= slice;
        }
    }

    private void clearSfx() {
        sfxJump = sfxSwap = sfxPickup = sfxDeath = sfxBounce = sfxWin = sfxBurn = false;
    }

    private void substep(float dt, Input in) {
        if (state == STATE_DEAD) {
            stateTimer += dt;
            if (stateTimer >= DEATH_PAUSE) reset(false);
            return;
        }
        if (state == STATE_WON) {
            stateTimer += dt;
            return;
        }

        time += dt;
        if (in.swap) {
            active = (active == Player.FIREY) ? Player.LEAFY : Player.FIREY;
            sfxSwap = true;
        }

        updateGateOccupancy();
        updateButton();
        updatePlayer(activePlayer(), in, dt);
        updatePlayer(idlePlayer(), Input.IDLE, dt);
        for (Crate c : crates) updateCrate(c, dt);
        updateFire(dt);

        checkTileEffects(firey);
        checkTileEffects(leafy);
        checkExit();
    }

    // -------------------------------------------------------------- player

    private void updatePlayer(Player p, Input in, float dt) {
        if (!p.alive) return;
        p.animTime += dt;

        char liquid = liquidAround(p);
        p.swimming = liquid != 0 && liquid == p.friendlyLiquid();

        int dir = (in.right ? 1 : 0) - (in.left ? 1 : 0);
        boolean pushing = touchingPushableCrate(p, dir);
        float maxSpeed = p.swimming ? SWIM_SPEED : (pushing ? PUSH_SPEED : MOVE_SPEED);

        if (dir != 0) {
            float accel = p.onGround ? (p.onIce ? ICE_ACCEL : GROUND_ACCEL) : AIR_ACCEL;
            p.vx += dir * accel * dt;
            p.facing = dir;
            if (p.vx > maxSpeed) p.vx = maxSpeed;
            if (p.vx < -maxSpeed) p.vx = -maxSpeed;
        } else {
            float friction = p.swimming ? SWIM_DRAG * 4f
                    : p.onGround ? (p.onIce ? ICE_FRICTION : GROUND_FRICTION) : AIR_FRICTION;
            p.vx = approach(p.vx, 0, friction * dt);
        }

        // Jump, coyote time and jump buffering.
        if (p.onGround) p.coyote = COYOTE_TIME;
        else p.coyote = Math.max(0, p.coyote - dt);
        if (in.jump && !p.jumpHeld) p.jumpBuffer = JUMP_BUFFER_TIME;
        else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
        boolean released = p.jumpHeld && !in.jump;
        p.jumpHeld = in.jump;

        if (p.swimming) {
            if (in.jump) p.vy -= SWIM_RISE_ACCEL * dt;
            p.vy += GRAVITY * SWIM_GRAVITY * dt;
            p.vy = approach(p.vy, 0, SWIM_DRAG * dt);
            if (p.vy < -SWIM_MAX_RISE) p.vy = -SWIM_MAX_RISE;
            if (p.vy > SWIM_MAX_SINK) p.vy = SWIM_MAX_SINK;
            p.gliding = false;
            p.jumpBuffer = 0;
        } else {
            if (p.jumpBuffer > 0 && p.coyote > 0) {
                p.vy = -JUMP_SPEED;
                p.onGround = false;
                p.coyote = 0;
                p.jumpBuffer = 0;
                sfxJump = true;
            }
            // Letting go on the way up gives a shorter hop. Applied once, on the
            // release itself, so it never nibbles away at a trampoline bounce.
            if (released && p.vy < 0) p.vy *= (1f - JUMP_CUT);

            p.gliding = !p.isFirey() && !p.onGround && p.vy > 0 && in.jump;
            float g = p.gliding ? GRAVITY * GLIDE_GRAVITY : GRAVITY;
            p.vy += g * dt;
            float maxFall = p.gliding ? GLIDE_MAX_FALL : MAX_FALL;
            if (p.vy > maxFall) p.vy = maxFall;
        }

        moveX(p, p.vx * dt, true, 0);
        moveY(p, p.vy * dt, in.down);

        if (p.y > level.height + 2) kill(p, "fell into the pit");
    }

    private void updateCrate(Crate c, float dt) {
        c.vy += GRAVITY * dt;
        if (c.vy > MAX_FALL) c.vy = MAX_FALL;
        c.vx = approach(c.vx, 0, GROUND_FRICTION * dt);
        moveX(c, c.vx * dt, false, 0);
        moveY(c, c.vy * dt, false);
        if (c.y > level.height + 4) {
            // A crate lost down a pit is gone; puzzles never require rescuing one.
            c.vy = 0;
        }
    }

    // ----------------------------------------------------------- collision

    private void moveX(Body b, float dx, boolean canPush, int depth) {
        if (dx == 0) return;
        b.x += dx;
        int top = floor(b.y + EPS);
        int bottom = floor(b.bottom() - EPS);
        if (dx > 0) {
            int col = floor(b.right() - EPS);
            for (int row = top; row <= bottom; row++) {
                if (solidAt(col, row)) {
                    b.x = col - b.w;
                    b.vx = 0;
                    break;
                }
            }
        } else {
            int col = floor(b.x + EPS);
            for (int row = top; row <= bottom; row++) {
                if (solidAt(col, row)) {
                    b.x = col + 1;
                    b.vx = 0;
                    break;
                }
            }
        }

        for (int i = 0; i < crates.size(); i++) {
            Crate c = crates.get(i);
            if (c == b || !b.overlaps(c)) continue;
            if (canPush && depth < MAX_PUSH_DEPTH) {
                float push = dx > 0 ? (b.right() - c.x) : (b.x - c.right());
                moveX(c, push, true, depth + 1);
                c.vx = 0;
            }
            if (b.overlaps(c)) {
                b.x = dx > 0 ? c.x - b.w : c.right();
                b.vx = 0;
            }
        }
    }

    private void moveY(Body b, float dy, boolean dropThrough) {
        if (dy == 0) {
            if (b.vy != 0) b.onGround = false;
            return;
        }
        float previousBottom = b.bottom();
        b.y += dy;
        b.onGround = false;
        b.onIce = false;

        int left = floor(b.x + EPS);
        int right = floor(b.right() - EPS);

        if (dy > 0) {
            int row = floor(b.bottom() - EPS);
            for (int col = left; col <= right; col++) {
                boolean blocking = solidAt(col, row);
                if (!blocking && Tiles.oneWay(tile(col, row)) && !dropThrough) {
                    blocking = previousBottom <= row + EPS;
                }
                if (blocking) {
                    b.y = row - b.h;
                    land(b, tile(col, row));
                    break;
                }
            }
        } else {
            int row = floor(b.y + EPS);
            for (int col = left; col <= right; col++) {
                if (solidAt(col, row)) {
                    b.y = row + 1;
                    b.vy = 0;
                    break;
                }
            }
        }

        for (int i = 0; i < crates.size(); i++) {
            Crate c = crates.get(i);
            if (c == b || !b.overlaps(c)) continue;
            if (dy > 0 && previousBottom <= c.y + EPS) {
                b.y = c.y - b.h;
                b.vy = 0;
                b.onGround = true;
            } else if (dy < 0) {
                b.y = c.bottom();
                b.vy = 0;
            }
        }
    }

    private void land(Body b, char tile) {
        if (tile == Tiles.TRAMPOLINE) {
            b.vy = -BOUNCE_SPEED;
            b.onGround = false;
            sfxBounce = true;
        } else {
            b.vy = 0;
            b.onGround = true;
            b.onIce = tile == Tiles.ICE;
        }
    }

    // ------------------------------------------------------- tile reactions

    private void checkTileEffects(Player p) {
        if (!p.alive || state != STATE_PLAYING) return;

        int c0 = floor(p.x + HAZARD_INSET);
        int c1 = floor(p.right() - HAZARD_INSET);
        int r0 = floor(p.y + HAZARD_INSET);
        int r1 = floor(p.bottom() - HAZARD_INSET);
        for (int r = r0; r <= r1; r++) {
            for (int c = c0; c <= c1; c++) {
                char t = tile(c, r);
                if (p.killedBy(t)) {
                    kill(p, deathCause(p, t));
                    return;
                }
            }
        }

        c0 = floor(p.x + PICKUP_INSET);
        c1 = floor(p.right() - PICKUP_INSET);
        r0 = floor(p.y + PICKUP_INSET);
        r1 = floor(p.bottom() - PICKUP_INSET);
        for (int r = r0; r <= r1; r++) {
            for (int c = c0; c <= c1; c++) {
                char t = tile(c, r);
                if (t == Tiles.CAKE) {
                    setTile(c, r, Tiles.EMPTY);
                    cakes++;
                    sfxPickup = true;
                } else if (t == Tiles.KEY) {
                    setTile(c, r, Tiles.EMPTY);
                    keys++;
                    sfxPickup = true;
                }
            }
        }

        if (p.isFirey()) igniteAround(p);
    }

    private String deathCause(Player p, char tile) {
        if (tile == Tiles.SPIKE) return p.displayName() + " hit the spikes";
        if (tile == Tiles.WATER) return "Firey went out in the water";
        if (tile == Tiles.LAVA) return "Leafy melted in the lava";
        if (tile == Tiles.BURNING) return "Leafy caught fire";
        return p.displayName() + " is out";
    }

    /** Firey sets any wood he leans against alight. */
    private void igniteAround(Player p) {
        int c0 = floor(p.x - 0.14f);
        int c1 = floor(p.right() + 0.14f);
        int r0 = floor(p.y - 0.14f);
        int r1 = floor(p.bottom() + 0.14f);
        for (int r = r0; r <= r1; r++) {
            for (int c = c0; c <= c1; c++) {
                if (tile(c, r) == Tiles.WOOD) ignite(c, r);
            }
        }
    }

    private void ignite(int col, int row) {
        if (tile(col, row) != Tiles.WOOD) return;
        setTile(col, row, Tiles.BURNING);
        burn[row][col] = BURN_TIME;
        sfxBurn = true;
    }

    /** Burning wood counts down, then collapses and lights its neighbours. */
    private void updateFire(float dt) {
        for (int r = 0; r < level.height; r++) {
            for (int c = 0; c < level.width; c++) {
                if (grid[r][c] != Tiles.BURNING) continue;
                burn[r][c] -= dt;
                if (burn[r][c] > 0) continue;
                grid[r][c] = Tiles.EMPTY;
                burn[r][c] = 0;
                ignite(c - 1, r);
                ignite(c + 1, r);
                ignite(c, r - 1);
                ignite(c, r + 1);
            }
        }
    }

    private void updateButton() {
        boolean pressed = false;
        if (firey.alive) pressed = pressesButton(firey);
        if (!pressed && leafy.alive) pressed = pressesButton(leafy);
        if (!pressed) {
            for (int i = 0; i < crates.size() && !pressed; i++) {
                pressed = pressesButton(crates.get(i));
            }
        }
        buttonPressed = pressed;
    }

    private boolean pressesButton(Body b) {
        int r = floor(b.bottom() - 0.06f);
        int c0 = floor(b.x + 0.12f);
        int c1 = floor(b.right() - 0.12f);
        for (int c = c0; c <= c1; c++) {
            if (tile(c, r) == Tiles.BUTTON) return true;
        }
        return false;
    }

    /**
     * A gate never closes on top of somebody. Any gate tile currently occupied
     * stays passable until whatever is standing in it steps clear.
     */
    private void updateGateOccupancy() {
        for (int r = 0; r < level.height; r++) {
            for (int c = 0; c < level.width; c++) {
                if (grid[r][c] != Tiles.GATE) continue;
                gateHeldOpen[r][c] = occupied(c, r);
            }
        }
    }

    private boolean occupied(int col, int row) {
        if (firey.alive && firey.overlapsTile(col, row, 0.05f)) return true;
        if (leafy.alive && leafy.overlapsTile(col, row, 0.05f)) return true;
        for (int i = 0; i < crates.size(); i++) {
            if (crates.get(i).overlapsTile(col, row, 0.05f)) return true;
        }
        return false;
    }

    private void checkExit() {
        if (state != STATE_PLAYING) return;
        if (!firey.alive || !leafy.alive) return;
        if (onExit(firey) && onExit(leafy)) {
            state = STATE_WON;
            stateTimer = 0;
            sfxWin = true;
        }
    }

    private boolean onExit(Player p) {
        int c0 = floor(p.x + EXIT_INSET);
        int c1 = floor(p.right() - EXIT_INSET);
        int r0 = floor(p.y + EXIT_INSET);
        int r1 = floor(p.bottom() - EXIT_INSET);
        for (int r = r0; r <= r1; r++) {
            for (int c = c0; c <= c1; c++) {
                if (tile(c, r) == Tiles.EXIT) return true;
            }
        }
        return false;
    }

    private void kill(Player p, String cause) {
        if (state != STATE_PLAYING) return;
        p.alive = false;
        state = STATE_DEAD;
        stateTimer = 0;
        deaths++;
        lastDeathCause = cause;
        sfxDeath = true;
    }

    /** The liquid a body is mostly submerged in, or 0. */
    private char liquidAround(Body b) {
        char t = tile(floor(b.centerX()), floor(b.centerY()));
        return Tiles.isLiquid(t) ? t : 0;
    }

    private boolean touchingPushableCrate(Player p, int dir) {
        if (dir == 0) return false;
        for (int i = 0; i < crates.size(); i++) {
            Crate c = crates.get(i);
            if (p.bottom() <= c.y + EPS || p.y >= c.bottom() - EPS) continue;
            float gap = dir > 0 ? (c.x - p.right()) : (p.x - c.right());
            if (gap > -0.05f && gap < 0.12f) return true;
        }
        return false;
    }

    // ------------------------------------------------------------- helpers

    private static float approach(float value, float target, float delta) {
        if (value < target) return Math.min(value + delta, target);
        return Math.max(value - delta, target);
    }

    private static int floor(float v) {
        int i = (int) v;
        return (v < i) ? i - 1 : i;
    }
}
