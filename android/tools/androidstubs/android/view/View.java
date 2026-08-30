package android.view;

import android.content.Context;

public class View {
    public static final int SYSTEM_UI_FLAG_LAYOUT_STABLE = 0x100;
    public static final int SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION = 0x200;
    public static final int SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN = 0x400;
    public static final int SYSTEM_UI_FLAG_HIDE_NAVIGATION = 0x2;
    public static final int SYSTEM_UI_FLAG_FULLSCREEN = 0x4;
    public static final int SYSTEM_UI_FLAG_IMMERSIVE_STICKY = 0x1000;
    public View(Context context) { }
    public void setFocusable(boolean focusable) { }
    public boolean requestFocus() { return true; }
    public int getWidth() { return 0; }
    public int getHeight() { return 0; }
    public void setSystemUiVisibility(int visibility) { }
    public boolean onTouchEvent(MotionEvent event) { return false; }
    public boolean onKeyDown(int keyCode, KeyEvent event) { return false; }
    public boolean onKeyUp(int keyCode, KeyEvent event) { return false; }
}
