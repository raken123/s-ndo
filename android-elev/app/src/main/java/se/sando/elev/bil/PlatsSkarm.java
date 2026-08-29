package se.sando.elev.bil;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import se.sando.elev.Delat;

/**
 * En enskild matteplats, läst i stillastående bil.
 *
 * Skärmen svarar på "ska jag gå hit?" och ingenting mer. Frågorna ligger kvar
 * i telefonen: fem stycken med tjugo sekunder var är inget man gör på en
 * bilskärm, ens parkerad — klockan är hela poängen och en bilskärm är fel
 * plats att ha bråttom på.
 */
public final class PlatsSkarm extends Screen {

    private final Delat.Plats plats;

    public PlatsSkarm(@NonNull CarContext ctx, @NonNull Delat.Plats plats) {
        super(ctx);
        this.plats = plats;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        Pane.Builder pane = new Pane.Builder();

        pane.addRow(new Row.Builder()
                .setTitle("Avstånd")
                .addText(PlatserSkarm.avstand(plats.meter))
                .build());

        pane.addRow(new Row.Builder()
                .setTitle("Nivå")
                .addText(plats.niva + " av 3 · " + belon(plats.niva) + " krediter per rätt svar")
                .build());

        pane.addRow(new Row.Builder()
                .setTitle(plats.klar ? "Klar" : "Fem frågor")
                .addText(plats.klar
                        ? "Du har redan klarat den här i dag. Den öppnar igen i morgon."
                        : "Tjugo sekunder per fråga. Gå de sista metrarna och svara i telefonen.")
                .build());

        return new PaneTemplate.Builder(pane.build())
                .setTitle(plats.namn)
                .setHeaderAction(Action.BACK)
                .build();
    }

    /* Samma trappa som i webbappen — se elev/js/platser.js. */
    private static int belon(int niva) {
        return niva <= 1 ? 400 : niva == 2 ? 900 : 1600;
    }
}
