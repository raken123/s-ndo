package se.sando.elev.bil;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.ParkedOnlyOnClickListener;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import java.util.List;

import se.sando.elev.Delat;

/**
 * Det Monni senast sa, för resan dit.
 *
 * Läxan tar tre timmar att åka till och Monni finns i telefonen. Det som
 * hamnar här är knuffarna — hjälpstegen, inte svaren. Monni ger aldrig ett
 * svar någonstans, och allra minst på en skärm där ingen kan räkna efter.
 */
public final class KnuffarSkarm extends Screen {

    public KnuffarSkarm(@NonNull CarContext ctx) {
        super(ctx);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        List<Delat.Knuff> knuffar = Delat.knuffar(getCarContext());

        if (knuffar.isEmpty()) {
            return new MessageTemplate.Builder(
                    "Inget sparat än. Fråga Monni något i telefonen, så följer knuffen med hit.")
                    .setTitle("Monnis knuffar")
                    .setHeaderAction(Action.BACK)
                    .build();
        }

        int tak = getCarContext().getCarService(ConstraintManager.class)
                .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST);

        ItemList.Builder lista = new ItemList.Builder();
        int n = 0;
        for (Delat.Knuff k : knuffar) {
            if (n++ >= tak) break;
            final Delat.Knuff denna = k;
            lista.addItem(new Row.Builder()
                    .setTitle(kort(k.fraga, 60))
                    .addText("Steg " + k.steg + " av 4 · " + kort(k.svar, 60))
                    .setBrowsable(true)
                    .setOnClickListener(ParkedOnlyOnClickListener.create(
                            () -> getScreenManager().push(new KnuffSkarm(getCarContext(), denna))))
                    .build());
        }

        return new ListTemplate.Builder()
                .setTitle("Monnis knuffar")
                .setHeaderAction(Action.BACK)
                .setSingleList(lista.build())
                .build();
    }

    static String kort(String s, int max) {
        if (s == null) return "";
        String t = s.trim().replaceAll("\\s+", " ");
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }

    /** Hela knuffen, styckad i rader som får plats på en bilskärm. */
    static final class KnuffSkarm extends Screen {
        private final Delat.Knuff knuff;

        KnuffSkarm(@NonNull CarContext ctx, @NonNull Delat.Knuff knuff) {
            super(ctx);
            this.knuff = knuff;
        }

        @NonNull
        @Override
        public Template onGetTemplate() {
            Pane.Builder pane = new Pane.Builder();
            pane.addRow(new Row.Builder()
                    .setTitle("Du frågade")
                    .addText(kort(knuff.fraga, 200))
                    .build());

            String[] rader = knuff.svar == null ? new String[0] : knuff.svar.split("\n");
            int lagda = 0;
            for (String r : rader) {
                String t = r.trim();
                if (t.isEmpty()) continue;
                if (lagda >= 3) break;      /* en Pane rymmer fyra rader totalt */
                pane.addRow(new Row.Builder()
                        .setTitle(lagda == 0 ? "Monni" : " ")
                        .addText(kort(t, 200))
                        .build());
                lagda++;
            }
            if (lagda == 0) {
                pane.addRow(new Row.Builder().setTitle("Monni").addText("—").build());
            }

            return new PaneTemplate.Builder(pane.build())
                    .setTitle("Steg " + knuff.steg + " av 4")
                    .setHeaderAction(Action.BACK)
                    .build();
        }
    }
}
