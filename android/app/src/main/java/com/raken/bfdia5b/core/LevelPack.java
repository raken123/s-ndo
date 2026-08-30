package com.raken.bfdia5b.core;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;

/** Reads the whole campaign out of one text file of '@level' blocks. */
public final class LevelPack {

    private final List<Level> levels;

    private LevelPack(List<Level> levels) {
        this.levels = levels;
    }

    public int size() {
        return levels.size();
    }

    public Level get(int index) {
        return levels.get(Math.max(0, Math.min(levels.size() - 1, index)));
    }

    public static LevelPack read(InputStream in) throws IOException {
        List<String> all = new ArrayList<>();
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(in, Charset.forName("UTF-8")));
        String line;
        while ((line = reader.readLine()) != null) {
            // Strip a trailing carriage return so CRLF files behave.
            if (line.endsWith("\r")) line = line.substring(0, line.length() - 1);
            all.add(line);
        }
        return parse(all);
    }

    public static LevelPack parse(List<String> lines) {
        List<Level> levels = new ArrayList<>();
        List<String> current = null;
        for (String line : lines) {
            if (line.startsWith("@level")) {
                if (current != null) levels.add(Level.parse(current));
                current = new ArrayList<>();
            }
            if (current != null) current.add(line);
        }
        if (current != null) levels.add(Level.parse(current));
        if (levels.isEmpty()) throw new Level.LevelFormatException("level pack is empty");
        return new LevelPack(levels);
    }
}
