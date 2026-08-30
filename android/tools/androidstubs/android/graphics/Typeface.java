package android.graphics;

public class Typeface {
    public static final int NORMAL = 0;
    public static final int BOLD = 1;
    public static final Typeface DEFAULT = new Typeface();
    public static final Typeface DEFAULT_BOLD = new Typeface();
    public static Typeface create(Typeface family, int style) { return DEFAULT; }
}
