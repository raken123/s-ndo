import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * Turns the source artwork into every launcher icon the app needs.
 *
 * <p>Run through tools/make-icons.sh. It needs nothing but a JDK, which is why
 * the icons are generated here rather than with an image editor.
 */
public final class MakeIcons {

    /** Density buckets, as a multiple of the baseline 48dp / 108dp icon. */
    private static final String[] DENSITIES = {"mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"};
    private static final float[] FACTORS = {1f, 1.5f, 2f, 3f, 4f};

    /** How much of the adaptive canvas the artwork covers; 66% is the safe zone. */
    private static final float ADAPTIVE_FILL = 0.78f;
    private static final Color BACKDROP = new Color(0xF6, 0xE3, 0xB8);

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: MakeIcons <source.png> <res-dir> [art-dir]");
            System.exit(2);
        }
        BufferedImage source = ImageIO.read(new File(args[0]));
        if (source == null) throw new IllegalArgumentException("cannot read " + args[0]);
        File res = new File(args[1]);

        for (int i = 0; i < DENSITIES.length; i++) {
            File dir = new File(res, "mipmap-" + DENSITIES[i]);
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdir " + dir);
            int legacy = Math.round(48 * FACTORS[i]);
            int adaptive = Math.round(108 * FACTORS[i]);
            write(rounded(scaled(source, legacy, legacy), legacy * 0.18f),
                    new File(dir, "ic_launcher.png"));
            write(circular(scaled(source, legacy, legacy)),
                    new File(dir, "ic_launcher_round.png"));
            write(adaptiveForeground(source, adaptive),
                    new File(dir, "ic_launcher_foreground.png"));
        }

        if (args.length > 2) {
            File art = new File(args[2]);
            if (!art.exists() && !art.mkdirs()) throw new IllegalStateException("mkdir " + art);
            write(scaled(source, 512, 512), new File(art, "icon-512.png"));
        }
        System.out.println("icons written to " + res);
    }

    private static BufferedImage scaled(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out.createGraphics());
        // Step the image down in halves first: one big jump looks noticeably worse.
        BufferedImage current = src;
        while (current.getWidth() / 2 > w && current.getHeight() / 2 > h) {
            current = half(current);
        }
        g.drawImage(current, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    private static BufferedImage half(BufferedImage src) {
        int w = Math.max(1, src.getWidth() / 2);
        int h = Math.max(1, src.getHeight() / 2);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out.createGraphics());
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    private static BufferedImage rounded(BufferedImage src, float radius) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(),
                BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out.createGraphics());
        g.setClip(new RoundRectangle2D.Float(0, 0, src.getWidth(), src.getHeight(),
                radius * 2, radius * 2));
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static BufferedImage circular(BufferedImage src) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(),
                BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out.createGraphics());
        g.setClip(new Ellipse2D.Float(0, 0, src.getWidth(), src.getHeight()));
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    /**
     * The adaptive foreground: the artwork sitting well inside the canvas so no
     * launcher mask can crop Firey's flames off.
     */
    private static BufferedImage adaptiveForeground(BufferedImage src, int size) {
        int art = Math.round(size * ADAPTIVE_FILL);
        BufferedImage scaled = rounded(scaled(src, art, art), art * 0.16f);
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = quality(out.createGraphics());
        int offset = (size - art) / 2;
        g.drawImage(scaled, offset, offset, null);
        g.dispose();
        return out;
    }

    private static Graphics2D quality(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        return g;
    }

    private static void write(BufferedImage image, File file) throws Exception {
        if (!ImageIO.write(image, "png", file)) {
            throw new IllegalStateException("no PNG writer for " + file);
        }
    }

    private MakeIcons() {
    }
}
