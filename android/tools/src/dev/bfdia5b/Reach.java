package dev.bfdia5b;

import com.raken.bfdia5b.core.Level;
import com.raken.bfdia5b.core.LevelPack;
import com.raken.bfdia5b.core.Player;

import java.io.FileInputStream;

/**
 * Prints a level with every cell a character can reach marked, which is how
 * you find the ledge you accidentally made one tile too high.
 *
 * <p>Usage: java dev.bfdia5b.Reach levels.txt [level-number]
 */
public final class Reach {

    public static void main(String[] args) throws Exception {
        String path = args.length > 0 ? args[0] : "app/src/main/assets/levels.txt";
        LevelPack pack;
        try (FileInputStream in = new FileInputStream(path)) {
            pack = LevelPack.read(in);
        }
        int from = 0, to = pack.size() - 1;
        if (args.length > 1) {
            from = to = Integer.parseInt(args[1]) - 1;
        }
        for (int i = from; i <= to; i++) {
            Level level = pack.get(i);
            System.out.println("=== " + (i + 1) + ". " + level.name);
            for (int kind = 0; kind < 2; kind++) {
                boolean[][] seen = new LevelValidator(level).flood(kind,
                        (int) (kind == Player.FIREY ? level.fireyX : level.leafyX),
                        (int) (kind == Player.FIREY ? level.fireyY : level.leafyY));
                System.out.println("--- " + (kind == Player.FIREY ? "Firey" : "Leafy"));
                for (int r = 0; r < level.height; r++) {
                    StringBuilder sb = new StringBuilder();
                    for (int c = 0; c < level.width; c++) {
                        char t = level.at(c, r);
                        sb.append(seen[r][c] && t == '.' ? '+' : t);
                    }
                    System.out.println(sb);
                }
            }
            System.out.println(String.join("; ", new LevelValidator(level).problems()));
        }
    }
}
