package android.graphics;

public class Paint {
    public static final int ANTI_ALIAS_FLAG = 1;
    public enum Style { FILL, STROKE, FILL_AND_STROKE }
    public enum Cap { BUTT, ROUND, SQUARE }
    public enum Join { MITER, ROUND, BEVEL }
    public enum Align { LEFT, CENTER, RIGHT }
    public Paint() { }
    public Paint(int flags) { }
    public void setStyle(Style style) { }
    public void setColor(int color) { }
    public void setStrokeWidth(float width) { }
    public void setStrokeCap(Cap cap) { }
    public void setStrokeJoin(Join join) { }
    public Shader setShader(Shader shader) { return shader; }
    public void setTextSize(float size) { }
    public void setTextAlign(Align align) { }
    public Typeface setTypeface(Typeface typeface) { return typeface; }
    public float measureText(String text) { return 0; }
}
