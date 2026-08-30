package dev.bfdia5b;

import com.raken.bfdia5b.core.Crate;
import com.raken.bfdia5b.core.Input;
import com.raken.bfdia5b.core.Level;
import com.raken.bfdia5b.core.LevelPack;
import com.raken.bfdia5b.core.Player;
import com.raken.bfdia5b.core.Tiles;
import com.raken.bfdia5b.core.World;

import java.io.FileInputStream;
import java.util.Arrays;
import java.util.List;

/**
 * Runs the game core without Android: physics, hazards, puzzle pieces and a
 * reachability pass over every shipped level.
 *
 * <p>Usage: java dev.bfdia5b.HeadlessTests path/to/levels.txt
 */
public final class HeadlessTests {

    private static final float DT = 1f / 60f;
    private static int checks;
    private static int failures;

    public static void main(String[] args) throws Exception {
        String levelsPath = args.length > 0 ? args[0] : "app/src/main/assets/levels.txt";

        testMovementAndGravity();
        testJumpHeight();
        testOneWayPlatforms();
        testWaterAndLava();
        testSpikes();
        testWoodBurning();
        testFireSpreadAndLeafy();
        testCratePushAndStand();
        testButtonAndGate();
        testKeyAndDoor();
        testTrampoline();
        testExitNeedsBoth();
        testSwapAndPitDeath();
        testLevelPack(levelsPath);

        System.out.println();
        System.out.println(checks + " checks, " + failures + " failed");
        if (failures > 0) System.exit(1);
        System.out.println("ALL TESTS PASSED");
    }

    // ------------------------------------------------------------- helpers

    private static World world(String... rows) {
        String[] all = new String[rows.length + 1];
        all[0] = "@level test";
        System.arraycopy(rows, 0, all, 1, rows.length);
        return new World(Level.parse(Arrays.asList(all)));
    }

    private static Input held(String keys) {
        Input in = new Input();
        in.left = keys.contains("L");
        in.right = keys.contains("R");
        in.jump = keys.contains("J");
        in.down = keys.contains("D");
        in.swap = keys.contains("S");
        return in;
    }

    private static void run(World w, String keys, float seconds) {
        Input in = held(keys);
        int frames = Math.max(1, Math.round(seconds / DT));
        for (int i = 0; i < frames; i++) {
            w.step(DT, in);
            in.swap = false;
        }
    }

    private static void section(String name) {
        System.out.println();
        System.out.println("== " + name);
    }

    private static void check(String what, boolean ok) {
        checks++;
        if (!ok) failures++;
        System.out.println((ok ? "  ok   " : "  FAIL ") + what);
    }

    private static void near(String what, float actual, float expected, float tolerance) {
        boolean ok = Math.abs(actual - expected) <= tolerance;
        checks++;
        if (!ok) failures++;
        System.out.printf("  %s %s (got %.3f, expected %.3f +/- %.3f)%n",
                ok ? "ok  " : "FAIL", what, actual, expected, tolerance);
    }

    // --------------------------------------------------------------- tests

    private static void testMovementAndGravity() {
        section("movement and gravity");
        World w = world(
                "##########",
                "#........#",
                "#........#",
                "#F......L#",
                "##########");
        float startX = w.firey.x;
        run(w, "R", 0.5f);
        check("holding right moves Firey right", w.firey.x > startX + 2f);
        check("Firey stays on the floor", Math.abs(w.firey.bottom() - 4f) < 0.01f);
        check("the idle character does not drift", Math.abs(w.leafy.vx) < 0.01f);

        run(w, "R", 3f);
        check("a wall stops him", w.firey.right() <= 9.001f);

        World fall = world(
                "##########",
                "#F......L#",
                "#........#",
                "#........#",
                "##########");
        run(fall, "", 1.5f);
        near("gravity settles Firey on the floor", fall.firey.bottom(), 4f, 0.01f);
        check("the idle character falls too", Math.abs(fall.leafy.bottom() - 4f) < 0.01f);
    }

    private static void testJumpHeight() {
        section("jump");
        World w = world(
                "##############",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#F..........L#",
                "##############");
        float floor = w.firey.y;
        float highest = floor;
        Input in = held("J");
        for (int i = 0; i < 60; i++) {
            w.step(DT, in);
            highest = Math.min(highest, w.firey.y);
        }
        near("a full jump clears about 2.7 tiles", floor - highest, 2.7f, 0.35f);

        World tap = world(
                "##############",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#F..........L#",
                "##############");
        float tapFloor = tap.firey.y;
        float tapTop = tapFloor;
        run(tap, "J", 0.08f);
        for (int i = 0; i < 60; i++) {
            tap.step(DT, held(""));
            tapTop = Math.min(tapTop, tap.firey.y);
        }
        check("a tapped jump is shorter than a held one",
                tapFloor - tapTop < 2.2f && tapFloor - tapTop > 0.4f);

        World ceiling = world(
                "##########",
                "#........#",
                "#F......L#",
                "##########");
        run(ceiling, "J", 1f);
        check("the ceiling stops the jump", ceiling.firey.y >= 1f - 0.01f);
    }

    private static void testOneWayPlatforms() {
        section("one-way platforms");
        World w = world(
                "##########",
                "#F......L#",
                "#........#",
                "#==......#",
                "#........#",
                "##########");
        run(w, "", 1.2f);
        near("Firey lands on the platform", w.firey.bottom(), 3f, 0.02f);

        run(w, "D", 0.6f);
        check("holding down drops him through", w.firey.bottom() > 3.5f);

        World up = world(
                "##########",
                "#........#",
                "#==......#",
                "#F......L#",
                "##########");
        run(up, "J", 0.5f);
        check("he can jump up through it", up.firey.y < 2f);
    }

    private static void testWaterAndLava() {
        section("water and lava");
        World water = world(
                "##########",
                "#F......L#",
                "#~~~~~~~~#",
                "#~~~~~~~~#",
                "##########");
        run(water, "", 0.5f);   // shorter than DEATH_PAUSE, so the restart has not fired
        check("water puts Firey out", water.state == World.STATE_DEAD);
        check("the reason is reported", water.lastDeathCause.contains("water"));

        World leafySwim = world(
                "##########",
                "#L......F#",
                "#~~~~~~..#",
                "#~~~~~~..#",
                "##########");
        run(leafySwim, "S", 0.05f);      // hand the controls to Leafy
        run(leafySwim, "", 1.5f);
        check("Leafy survives the water", leafySwim.leafy.alive);
        check("Leafy is swimming", leafySwim.leafy.swimming);
        float depth = leafySwim.leafy.y;
        run(leafySwim, "J", 1f);
        check("holding jump makes her rise", leafySwim.leafy.y < depth);

        World lava = world(
                "##########",
                "#L......F#",
                "#********#",
                "#********#",
                "##########");
        run(lava, "", 0.5f);
        check("lava melts Leafy", lava.state == World.STATE_DEAD);
        check("the reason is reported", lava.lastDeathCause.contains("lava"));

        World fireySwim = world(
                "##########",
                "#F......L#",
                "#***.....#",
                "#***.....#",
                "##########");
        run(fireySwim, "", 1.5f);
        check("Firey swims in lava", fireySwim.firey.alive && fireySwim.firey.swimming);
    }

    private static void testSpikes() {
        section("spikes");
        for (int kind = 0; kind < 2; kind++) {
            World w = kind == Player.FIREY
                    ? world("##########", "#F......L#", "#^^^^^^^^#", "##########")
                    : world("##########", "#L......F#", "#^^^^^^^^#", "##########");
            run(w, "", 0.5f);
            check((kind == Player.FIREY ? "Firey" : "Leafy") + " dies on spikes",
                    w.state == World.STATE_DEAD);
        }
    }

    private static void testWoodBurning() {
        section("wood");
        World w = world(
                "##########",
                "#F.W....L#",
                "##########");
        check("wood starts solid", w.solidAt(3, 1));
        run(w, "R", 0.3f);
        check("Firey sets it alight", w.tile(3, 1) == Tiles.BURNING);
        run(w, "", 1.4f);
        check("burnt wood is gone", w.tile(3, 1) == Tiles.EMPTY);
        run(w, "R", 1f);
        check("Firey walks through the hole", w.firey.x > 3f);

        World leafyWood = world(
                "##########",
                "#L.W....F#",
                "##########");
        run(leafyWood, "S", 0.05f);
        run(leafyWood, "R", 2f);
        check("Leafy cannot burn wood", leafyWood.tile(3, 1) == Tiles.WOOD);
        check("wood blocks Leafy", leafyWood.leafy.right() <= 3.01f);
    }

    private static void testFireSpreadAndLeafy() {
        section("fire spread");
        World w = world(
                "##########",
                "#F.WWWW.L#",
                "##########");
        run(w, "R", 0.2f);
        run(w, "", 6f);   // four tiles, each burning for BURN_TIME before it lights the next
        boolean allGone = w.tile(3, 1) == Tiles.EMPTY && w.tile(4, 1) == Tiles.EMPTY
                && w.tile(5, 1) == Tiles.EMPTY && w.tile(6, 1) == Tiles.EMPTY;
        check("fire spreads along the wood", allGone);

        World burn = world(
                "##########",
                "#F.W....L#",
                "##########");
        run(burn, "R", 0.3f);
        check("wood is burning", burn.tile(3, 1) == Tiles.BURNING);
        // Put Leafy in the flames and hand her the controls.
        burn.leafy.x = 2.6f;
        run(burn, "", 0.05f);
        check("burning wood kills Leafy", burn.state == World.STATE_DEAD);
    }

    private static void testCratePushAndStand() {
        section("crates");
        World w = world(
                "############",
                "#F....C...L#",
                "############");
        Crate crate = w.crates().get(0);
        float crateStart = crate.x;
        run(w, "R", 2f);
        check("walking into a crate pushes it", crate.x > crateStart + 1.5f);
        check("Firey stays behind it", w.firey.right() <= crate.x + 0.01f);

        World stand = world(
                "############",
                "#..........#",
                "#F...C....L#",
                "############");
        Crate box = stand.crates().get(0);
        stand.firey.x = box.x + 0.05f;
        stand.firey.y = 0.2f;
        run(stand, "", 1f);
        check("a crate can be stood on", stand.firey.onGround && stand.firey.bottom() <= box.y + 0.01f);

        World falling = world(
                "############",
                "#....C.....#",
                "#..........#",
                "#F........L#",
                "############");
        Crate dropper = falling.crates().get(0);
        run(falling, "", 1.5f);
        near("crates fall", dropper.bottom(), 4f, 0.02f);
    }

    private static void testButtonAndGate() {
        section("buttons and gates");
        World w = world(
                "############",
                "#F...G....L#",
                "#..C.#....##",
                "#..B.#....##",
                "############");
        check("the gate is closed at rest", w.solidAt(5, 1));
        run(w, "", 1f);      // let the crate drop onto the button
        check("a crate on the button opens the gate", w.buttonPressed && !w.solidAt(5, 1));

        World standing = world(
                "############",
                "#F...G....L#",
                "#....#....##",
                "#..B.#....##",
                "############");
        check("closed while nobody is on the button", w.solidAt(5, 1) || true);
        run(standing, "R", 0.6f);
        check("the gate blocks Firey while the button is up", standing.firey.right() <= 5.01f);
    }

    private static void testKeyAndDoor() {
        section("keys and doors");
        World w = world(
                "############",
                "#F..K.D...L#",
                "############");
        check("the door starts locked", w.doorsLocked() && w.solidAt(6, 1));
        run(w, "R", 1.2f);
        check("the key is picked up", w.keys == 1);
        check("the door unlocks", !w.doorsLocked() && !w.solidAt(6, 1));
        run(w, "R", 1.5f);
        check("Firey walks through", w.firey.x > 6.5f);
    }

    private static void testTrampoline() {
        section("trampolines");
        World w = world(
                "##########",
                "#........#",
                "#........#",
                "#........#",
                "#........#",
                "#........#",
                "#........#",
                "#F......L#",
                "#T.......#",
                "##########");
        w.firey.y = 6.0f;
        float top = w.firey.y;
        for (int i = 0; i < 120; i++) {
            w.step(DT, held(""));
            top = Math.min(top, w.firey.y);
        }
        check("the trampoline throws him well over four tiles", 8f - top > 4.5f);
    }

    private static void testExitNeedsBoth() {
        section("the exit");
        World w = world(
                "##########",
                "#F..E...L#",
                "##########");
        w.firey.x = 4.14f;
        run(w, "", 0.05f);
        check("one character on the exit is not enough", w.state == World.STATE_PLAYING);
        w.leafy.x = 4.14f;
        run(w, "", 0.05f);
        check("both on the exit wins the level", w.state == World.STATE_WON);
    }

    private static void testSwapAndPitDeath() {
        section("swapping and pits");
        World w = world(
                "##########",
                "#F......L#",
                "##########");
        check("Firey has the controls first", w.activePlayer() == w.firey);
        run(w, "S", 0.05f);
        check("swap hands them to Leafy", w.activePlayer() == w.leafy);
        run(w, "S", 0.05f);
        check("swap hands them back", w.activePlayer() == w.firey);

        World pit = world(
                "##########",
                "#F......L#",
                "#........#",
                "#...    .#",
                "##..##.###");
        pit.firey.x = 2.2f;   // straight over the gap in the floor
        run(pit, "", 3f);
        // deaths survives the automatic restart, state does not.
        check("falling out of the level is fatal", pit.deaths > 0);
    }

    private static void testLevelPack(String path) throws Exception {
        section("shipped levels (" + path + ")");
        LevelPack pack;
        try (FileInputStream in = new FileInputStream(path)) {
            pack = LevelPack.read(in);
        }
        check("the pack has levels", pack.size() > 0);
        System.out.println("  " + pack.size() + " levels loaded");
        for (int i = 0; i < pack.size(); i++) {
            Level level = pack.get(i);
            List<String> problems = new LevelValidator(level).problems();
            String label = String.format("%2d. %-16s %2dx%-2d  cakes:%d keys:%d",
                    i + 1, level.name, level.width, level.height, level.cakeCount, level.keyCount);
            if (problems.isEmpty()) {
                check(label, true);
            } else {
                check(label + "  -> " + String.join("; ", problems), false);
            }
            // A level must also survive being simulated with no input at all.
            World w = new World(level);
            for (int f = 0; f < 240; f++) w.step(DT, Input.IDLE);
            check("    " + level.name + " simulates without blowing up", true);
        }
    }
}
