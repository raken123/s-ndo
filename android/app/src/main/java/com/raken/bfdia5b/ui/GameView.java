package com.raken.bfdia5b.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.util.Log;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

import com.raken.bfdia5b.core.Input;
import com.raken.bfdia5b.core.Level;
import com.raken.bfdia5b.core.LevelPack;
import com.raken.bfdia5b.core.World;

import java.io.IOException;
import java.io.InputStream;

/**
 * The whole front end: a surface, a game thread and three screens (title,
 * level select, play).
 */
public final class GameView extends SurfaceView implements Runnable, SurfaceHolder.Callback {

    private static final String TAG = "BFDIA5B";
    private static final int TITLE = 0;
    private static final int SELECT = 1;
    private static final int PLAY = 2;
    private static final long FRAME_NANOS = 16_000_000L;

    private final SurfaceHolder holder;
    private final Renderer renderer = new Renderer();
    private final Controls controls = new Controls();
    private final Save save;
    private final Sfx sfx;

    private LevelPack pack;
    private String[] levelNames = new String[0];
    private String loadError;

    private World world;
    private int levelIndex;
    private boolean clearRecorded;

    private int screen = TITLE;
    private float phase;

    private Thread thread;
    private volatile boolean running;

    // Touch and key state, written on the UI thread and read by the game thread.
    private final Object lock = new Object();
    private boolean heldLeft, heldRight, heldDown, heldJump;
    private boolean pendingSwap;
    private final Input frameInput = new Input();

    public GameView(Context context) {
        super(context);
        holder = getHolder();
        holder.addCallback(this);
        setFocusable(true);
        save = new Save(context);
        sfx = new Sfx();
        sfx.setMuted(save.isMuted());
        loadLevels(context);
    }

    private void loadLevels(Context context) {
        InputStream in = null;
        try {
            in = context.getAssets().open("levels.txt");
            pack = LevelPack.read(in);
            levelNames = new String[pack.size()];
            for (int i = 0; i < pack.size(); i++) levelNames[i] = pack.get(i).name;
        } catch (IOException e) {
            loadError = "Could not read levels.txt";
            Log.e(TAG, "level pack missing", e);
        } catch (Level.LevelFormatException e) {
            loadError = e.getMessage();
            Log.e(TAG, "bad level pack", e);
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (IOException ignored) {
                    // Nothing useful to do.
                }
            }
        }
    }

    // -------------------------------------------------------- surface hooks

    @Override
    public void surfaceCreated(SurfaceHolder h) {
        start();
    }

    @Override
    public void surfaceChanged(SurfaceHolder h, int format, int width, int height) {
        controls.layout(width, height, pack == null ? 0 : pack.size());
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder h) {
        stop();
    }

    void start() {
        if (running) return;
        running = true;
        thread = new Thread(this, "bfdia5b-loop");
        thread.start();
    }

    void stop() {
        running = false;
        Thread t = thread;
        thread = null;
        if (t == null) return;
        try {
            t.join(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    void release() {
        sfx.release();
    }

    // ------------------------------------------------------------ the loop

    @Override
    public void run() {
        long last = System.nanoTime();
        while (running) {
            long now = System.nanoTime();
            float dt = (now - last) / 1_000_000_000f;
            last = now;
            if (dt > 0.1f) dt = 0.1f;

            update(dt);
            drawFrame();

            long spare = FRAME_NANOS - (System.nanoTime() - now);
            if (spare > 0) {
                try {
                    Thread.sleep(spare / 1_000_000L, (int) (spare % 1_000_000L));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
    }

    private void update(float dt) {
        phase += dt;
        if (screen != PLAY || world == null) return;

        synchronized (lock) {
            frameInput.left = heldLeft;
            frameInput.right = heldRight;
            frameInput.down = heldDown;
            frameInput.jump = heldJump;
            frameInput.swap = pendingSwap;
            pendingSwap = false;
        }
        world.step(dt, frameInput);
        playSounds();

        if (world.state == World.STATE_WON && !clearRecorded) {
            clearRecorded = true;
            save.recordClear(levelIndex, world.cakes, world.time);
            save.unlockUpTo(Math.min(pack.size(), levelIndex + 2));
        }
    }

    private void playSounds() {
        if (world.sfxJump) sfx.play(Sfx.JUMP);
        if (world.sfxSwap) sfx.play(Sfx.SWAP);
        if (world.sfxPickup) sfx.play(Sfx.PICKUP);
        if (world.sfxBounce) sfx.play(Sfx.BOUNCE);
        if (world.sfxBurn) sfx.play(Sfx.BURN);
        if (world.sfxDeath) sfx.play(Sfx.DEATH);
        if (world.sfxWin) sfx.play(Sfx.WIN);
    }

    private void drawFrame() {
        Canvas canvas = null;
        try {
            canvas = holder.lockCanvas();
            if (canvas == null) return;
            draw(canvas);
        } catch (IllegalArgumentException | IllegalStateException e) {
            Log.w(TAG, "dropped a frame", e);
        } finally {
            if (canvas != null) {
                try {
                    holder.unlockCanvasAndPost(canvas);
                } catch (IllegalArgumentException | IllegalStateException e) {
                    Log.w(TAG, "could not post a frame", e);
                }
            }
        }
    }

    private void draw(Canvas canvas) {
        if (controls.width == 0) {
            controls.layout(getWidth(), getHeight(), pack == null ? 0 : pack.size());
        }
        if (pack == null) {
            renderer.drawLoading(canvas, controls.width, controls.height,
                    loadError == null ? "Loading..." : loadError);
            return;
        }
        switch (screen) {
            case TITLE:
                renderer.drawTitle(canvas, controls, phase, clearedCount(), pack.size());
                break;
            case SELECT:
                renderer.drawSelect(canvas, controls, save, levelNames,
                        save.unlockedCount(), phase);
                break;
            default:
                renderer.drawGame(canvas, world, controls, save, levelIndex, phase,
                        save.isMuted());
                break;
        }
    }

    private int clearedCount() {
        int n = 0;
        for (int i = 0; i < pack.size(); i++) if (save.isCleared(i)) n++;
        return n;
    }

    // ----------------------------------------------------------- navigation

    private void startLevel(int index) {
        levelIndex = Math.max(0, Math.min(pack.size() - 1, index));
        world = new World(pack.get(levelIndex));
        clearRecorded = false;
        screen = PLAY;
        synchronized (lock) {
            heldLeft = heldRight = heldDown = heldJump = false;
            pendingSwap = false;
        }
    }

    /** Handles the system back gesture. Returns false when there is nowhere left to go. */
    public boolean onBack() {
        if (screen == PLAY) {
            screen = SELECT;
            return true;
        }
        if (screen == SELECT) {
            screen = TITLE;
            return true;
        }
        return false;
    }

    // --------------------------------------------------------------- input

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
            int index = event.getActionIndex();
            press(event.getX(index), event.getY(index));
        }
        int lifted = -1;
        if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP) {
            lifted = event.getActionIndex();
        }
        boolean cancelled = action == MotionEvent.ACTION_CANCEL;
        refreshHeld(event, lifted, cancelled);
        return true;
    }

    private void refreshHeld(MotionEvent event, int lifted, boolean cancelled) {
        boolean left = false, right = false, down = false, jump = false;
        if (!cancelled && screen == PLAY && world != null && world.state != World.STATE_WON) {
            for (int i = 0; i < event.getPointerCount(); i++) {
                if (i == lifted) continue;
                switch (controls.hitPad(event.getX(i), event.getY(i))) {
                    case Controls.LEFT: left = true; break;
                    case Controls.RIGHT: right = true; break;
                    case Controls.DOWN: down = true; break;
                    case Controls.JUMP: jump = true; break;
                    default: break;
                }
            }
        }
        synchronized (lock) {
            heldLeft = left;
            heldRight = right;
            heldDown = down;
            heldJump = jump;
        }
    }

    private void press(float x, float y) {
        if (pack == null) return;
        switch (screen) {
            case TITLE:
                screen = SELECT;
                break;
            case SELECT:
                int card = controls.hitCard(x, y);
                if (card >= Controls.LEVEL_CARD) {
                    int index = card - Controls.LEVEL_CARD;
                    if (index < save.unlockedCount()) {
                        startLevel(index);
                        sfx.play(Sfx.SWAP);
                    }
                } else if (y < controls.height * 0.22f) {
                    screen = TITLE;
                }
                break;
            default:
                pressInGame(x, y);
                break;
        }
    }

    private void pressInGame(float x, float y) {
        if (world == null) return;
        if (world.state == World.STATE_WON) {
            boolean hasNext = levelIndex + 1 < pack.size();
            switch (controls.hitOverlay(x, y, hasNext)) {
                case Controls.OVERLAY_NEXT:
                    startLevel(levelIndex + 1);
                    break;
                case Controls.OVERLAY_RETRY:
                    startLevel(levelIndex);
                    break;
                case Controls.OVERLAY_MENU:
                    screen = SELECT;
                    break;
                default:
                    break;
            }
            return;
        }
        switch (controls.hitPad(x, y)) {
            case Controls.SWAP:
                synchronized (lock) {
                    pendingSwap = true;
                }
                break;
            case Controls.RESTART:
                startLevel(levelIndex);
                break;
            case Controls.MENU:
                screen = SELECT;
                break;
            case Controls.MUTE:
                boolean muted = !save.isMuted();
                save.setMuted(muted);
                sfx.setMuted(muted);
                break;
            default:
                break;
        }
    }

    /** Hardware keys, handy on a Chromebook or an emulator. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (screen != PLAY) {
            if (isAction(keyCode)) {
                if (screen == TITLE) screen = SELECT;
                else if (pack != null) startLevel(0);
                return true;
            }
            return super.onKeyDown(keyCode, event);
        }
        synchronized (lock) {
            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_LEFT: case KeyEvent.KEYCODE_A: heldLeft = true; return true;
                case KeyEvent.KEYCODE_DPAD_RIGHT: case KeyEvent.KEYCODE_D: heldRight = true; return true;
                case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_S: heldDown = true; return true;
                case KeyEvent.KEYCODE_SPACE: case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_W:
                    heldJump = true;
                    return true;
                case KeyEvent.KEYCODE_SHIFT_LEFT: case KeyEvent.KEYCODE_TAB: case KeyEvent.KEYCODE_E:
                    if (event.getRepeatCount() == 0) pendingSwap = true;
                    return true;
                case KeyEvent.KEYCODE_R:
                    break;
                default:
                    break;
            }
        }
        if (keyCode == KeyEvent.KEYCODE_R) {
            startLevel(levelIndex);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        synchronized (lock) {
            switch (keyCode) {
                case KeyEvent.KEYCODE_DPAD_LEFT: case KeyEvent.KEYCODE_A: heldLeft = false; return true;
                case KeyEvent.KEYCODE_DPAD_RIGHT: case KeyEvent.KEYCODE_D: heldRight = false; return true;
                case KeyEvent.KEYCODE_DPAD_DOWN: case KeyEvent.KEYCODE_S: heldDown = false; return true;
                case KeyEvent.KEYCODE_SPACE: case KeyEvent.KEYCODE_DPAD_UP: case KeyEvent.KEYCODE_W:
                    heldJump = false;
                    return true;
                default:
                    break;
            }
        }
        return super.onKeyUp(keyCode, event);
    }

    private static boolean isAction(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_SPACE || keyCode == KeyEvent.KEYCODE_ENTER
                || keyCode == KeyEvent.KEYCODE_DPAD_CENTER;
    }
}
