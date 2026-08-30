package android.graphics;

public class Canvas {
    public int save() { return 0; }
    public void restore() { }
    public void translate(float dx, float dy) { }
    public void rotate(float degrees, float px, float py) { }
    public void drawRect(float l, float t, float r, float b, Paint p) { }
    public void drawRect(RectF rect, Paint p) { }
    public void drawRoundRect(RectF rect, float rx, float ry, Paint p) { }
    public void drawCircle(float cx, float cy, float radius, Paint p) { }
    public void drawLine(float x0, float y0, float x1, float y1, Paint p) { }
    public void drawPath(Path path, Paint p) { }
    public void drawOval(RectF oval, Paint p) { }
    public void drawArc(RectF oval, float start, float sweep, boolean center, Paint p) { }
    public void drawText(String text, float x, float y, Paint p) { }
    public int getWidth() { return 0; }
    public int getHeight() { return 0; }
}
