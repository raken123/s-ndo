package com.raken.bfdia5b.ui;

import android.graphics.RectF;

/**
 * Screen layout for everything touchable: the on-screen pad, the level cards
 * and the overlay buttons. The renderer draws these rectangles and the view
 * hit-tests them, so the two can never drift apart.
 */
final class Controls {

    static final int NONE = -1;
    static final int LEFT = 0;
    static final int RIGHT = 1;
    static final int DOWN = 2;
    static final int JUMP = 3;
    static final int SWAP = 4;
    static final int RESTART = 5;
    static final int MENU = 6;
    static final int MUTE = 7;

    static final int OVERLAY_NEXT = 20;
    static final int OVERLAY_RETRY = 21;
    static final int OVERLAY_MENU = 22;

    static final int LEVEL_CARD = 100;   // plus the level index

    final RectF left = new RectF();
    final RectF right = new RectF();
    final RectF down = new RectF();
    final RectF jump = new RectF();
    final RectF swap = new RectF();
    final RectF restart = new RectF();
    final RectF menu = new RectF();
    final RectF mute = new RectF();

    final RectF overlayNext = new RectF();
    final RectF overlayRetry = new RectF();
    final RectF overlayMenu = new RectF();

    private final RectF[] cards = new RectF[64];
    private int cardCount;

    int width, height;
    float unit;

    Controls() {
        for (int i = 0; i < cards.length; i++) cards[i] = new RectF();
    }

    void layout(int w, int h, int levelCount) {
        width = w;
        height = h;
        unit = Math.min(h * 0.22f, w * 0.12f);
        float pad = Math.min(h * 0.05f, w * 0.03f);
        float u = unit;

        float baseY = h - pad;
        left.set(pad, baseY - u, pad + u, baseY);
        right.set(pad + u * 1.12f, baseY - u, pad + u * 2.12f, baseY);
        down.set(pad + u * 0.56f, baseY - u * 2.12f, pad + u * 1.56f, baseY - u * 1.12f);

        jump.set(w - pad - u * 1.30f, baseY - u * 1.30f, w - pad, baseY);
        swap.set(w - pad - u * 2.55f, baseY - u * 1.05f, w - pad - u * 1.45f, baseY);

        float s = Math.min(h * 0.11f, w * 0.06f);
        float top = pad * 0.5f;
        menu.set(w - pad * 0.5f - s, top, w - pad * 0.5f, top + s);
        restart.set(menu.left - s * 1.25f, top, menu.left - s * 0.25f, top + s);
        mute.set(restart.left - s * 1.25f, top, restart.left - s * 0.25f, top + s);

        float bw = Math.min(w * 0.24f, u * 2.2f);
        float bh = Math.min(h * 0.13f, u * 0.9f);
        float cy = h * 0.72f;
        overlayRetry.set(w / 2f - bw / 2, cy, w / 2f + bw / 2, cy + bh);
        overlayMenu.set(overlayRetry.left - bw * 1.15f, cy, overlayRetry.left - bw * 0.15f, cy + bh);
        overlayNext.set(overlayRetry.right + bw * 0.15f, cy, overlayRetry.right + bw * 1.15f, cy + bh);

        layoutCards(w, h, levelCount);
    }

    private void layoutCards(int w, int h, int levelCount) {
        cardCount = Math.min(levelCount, cards.length);
        int columns = Math.max(1, (int) Math.ceil(cardCount / 2.0));
        if (columns > 8) columns = (int) Math.ceil(cardCount / 3.0);
        int rows = (int) Math.ceil(cardCount / (float) columns);
        float marginX = w * 0.06f;
        float top = h * 0.30f;
        float bottom = h * 0.92f;
        float gap = w * 0.012f;
        float cw = (w - marginX * 2 - gap * (columns - 1)) / columns;
        float ch = Math.min((bottom - top - gap * (rows - 1)) / rows, cw * 1.1f);
        for (int i = 0; i < cardCount; i++) {
            int col = i % columns;
            int row = i / columns;
            float x = marginX + col * (cw + gap);
            float y = top + row * (ch + gap);
            cards[i].set(x, y, x + cw, y + ch);
        }
    }

    RectF card(int index) {
        return cards[index];
    }

    int cardCount() {
        return cardCount;
    }

    /** Which pad button, if any, a finger at (x, y) is on. */
    int hitPad(float x, float y) {
        if (left.contains(x, y)) return LEFT;
        if (right.contains(x, y)) return RIGHT;
        if (down.contains(x, y)) return DOWN;
        if (inCircle(jump, x, y)) return JUMP;
        if (swap.contains(x, y)) return SWAP;
        if (restart.contains(x, y)) return RESTART;
        if (menu.contains(x, y)) return MENU;
        if (mute.contains(x, y)) return MUTE;
        return NONE;
    }

    int hitOverlay(float x, float y, boolean hasNext) {
        if (hasNext && overlayNext.contains(x, y)) return OVERLAY_NEXT;
        if (overlayRetry.contains(x, y)) return OVERLAY_RETRY;
        if (overlayMenu.contains(x, y)) return OVERLAY_MENU;
        return NONE;
    }

    int hitCard(float x, float y) {
        for (int i = 0; i < cardCount; i++) {
            if (cards[i].contains(x, y)) return LEVEL_CARD + i;
        }
        return NONE;
    }

    private static boolean inCircle(RectF r, float x, float y) {
        float cx = r.centerX(), cy = r.centerY();
        float rad = r.width() / 2;
        float dx = x - cx, dy = y - cy;
        return dx * dx + dy * dy <= rad * rad * 1.2f;
    }
}
