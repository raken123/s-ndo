package com.pquit.blocker;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Locale;

/**
 * Full screen "you're in a cooldown" wall, shown when a blocked app is opened.
 * Built in code so the plugin needs no layout resources of its own.
 */
public class BlockActivity extends Activity {

    public static final String EXTRA_PACKAGE = "blocked_package";

    private static final int BG = 0xFF12162A;
    private static final int CARD = 0xFF1B2140;
    private static final int RED = 0xFFE12C3C;
    private static final int MUTED = 0xFF9AA3C7;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView countdown;
    private TextView blockedLabel;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            long left = LockState.remaining(BlockActivity.this);
            if (left <= 0) {
                finish();
                return;
            }
            countdown.setText(format(left));
            handler.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildView());
        blockedLabel.setText(labelFor(getIntent().getStringExtra(EXTRA_PACKAGE)));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        blockedLabel.setText(labelFor(intent.getStringExtra(EXTRA_PACKAGE)));
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (LockState.remaining(this) <= 0) {
            finish();
            return;
        }
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        goHome();
    }

    private View buildView() {
        int pad = dp(24);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(BG);
        root.setPadding(pad, pad, pad, pad);

        View dot = new View(this);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(RED);
        dot.setBackground(circle);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dp(72), dp(72));
        dotLp.bottomMargin = dp(20);
        root.addView(dot, dotLp);

        root.addView(text("Locked", 30, Color.WHITE, Typeface.BOLD, dp(6)));

        blockedLabel = text("", 15, MUTED, Typeface.NORMAL, dp(24));
        root.addView(blockedLabel);

        countdown = text("--:--", 56, RED, Typeface.BOLD, dp(8));
        countdown.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        root.addView(countdown);

        root.addView(text("left on the cooldown you started", 15, MUTED, Typeface.NORMAL, dp(28)));

        TextView pep = text(
                "You already made this decision. Nothing here needs a reply from you right now"
                        + " - put the phone down, or come back to PQuit and play something.",
                15, 0xFFC9D1F5, Typeface.NORMAL, dp(28));
        pep.setGravity(Gravity.CENTER);
        pep.setLineSpacing(dp(4), 1f);
        LinearLayout.LayoutParams pepLp =
                (LinearLayout.LayoutParams) pep.getLayoutParams();
        pepLp.leftMargin = dp(8);
        pepLp.rightMargin = dp(8);
        root.addView(pep);

        Button play = button("Play a game instead", RED, Color.WHITE);
        play.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPQuit();
            }
        });
        root.addView(play);

        Button home = button("Go home", CARD, 0xFFC9D1F5);
        home.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                goHome();
            }
        });
        root.addView(home);

        return root;
    }

    private TextView text(String s, int sp, int color, int style, int marginBottom) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setTypeface(Typeface.DEFAULT, style);
        t.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = marginBottom;
        t.setLayoutParams(lp);
        return t;
    }

    private Button button(String label, int bg, int fg) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(fg);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable shape = new GradientDrawable();
        shape.setCornerRadius(dp(28));
        shape.setColor(bg);
        b.setBackground(shape);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        lp.bottomMargin = dp(12);
        b.setLayoutParams(lp);
        return b;
    }

    private void openPQuit() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i != null) {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        }
        finish();
    }

    private void goHome() {
        startActivity(new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

    private String labelFor(String pkg) {
        if (pkg == null) return "That app is on hold";
        try {
            CharSequence name = getPackageManager()
                    .getApplicationLabel(getPackageManager().getApplicationInfo(pkg, 0));
            return name + " is on hold";
        } catch (Exception e) {
            return "That app is on hold";
        }
    }

    static String format(long ms) {
        long total = (ms + 999) / 1000;
        long h = total / 3600;
        long m = (total % 3600) / 60;
        long s = total % 60;
        return h > 0
                ? String.format(Locale.US, "%d:%02d:%02d", h, m, s)
                : String.format(Locale.US, "%02d:%02d", m, s);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
