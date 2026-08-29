package se.sando.elev.bil;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

import se.sando.elev.Delat;

/** Bilens startsida: två vägar in, och saldot. */
public final class StartSkarm extends Screen {

    public StartSkarm(@NonNull CarContext ctx) {
        super(ctx);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        List<Delat.Plats> platser = Delat.platser(getCarContext());
        List<Delat.Knuff> knuffar = Delat.knuffar(getCarContext());

        int kvar = 0;
        for (Delat.Plats p : platser) if (!p.klar) kvar++;

        ItemList.Builder lista = new ItemList.Builder();

        lista.addItem(new Row.Builder()
                .setTitle("Matteplatser")
                .addText(platser.isEmpty()
                        ? "Öppna appen i telefonen och leta upp platser först"
                        : kvar + " kvar av " + platser.size() + " i närheten")
                .setBrowsable(true)
                .setOnClickListener(() -> getScreenManager().push(new PlatserSkarm(getCarContext())))
                .build());

        lista.addItem(new Row.Builder()
                .setTitle("Monnis senaste knuffar")
                .addText(knuffar.isEmpty()
                        ? "Inget sparat än — fråga Monni något i telefonen"
                        : knuffar.size() + " sparade")
                .setBrowsable(true)
                .setOnClickListener(() -> getScreenManager().push(new KnuffarSkarm(getCarContext())))
                .build());

        lista.addItem(new Row.Builder()
                .setTitle("Krediter")
                .addText(NumberFormat.getIntegerInstance(new Locale("sv", "SE"))
                        .format(Delat.krediter(getCarContext())))
                .build());

        return new ListTemplate.Builder()
                .setTitle("Sändo Elev")
                .setHeaderAction(Action.APP_ICON)
                .setSingleList(lista.build())
                .build();
    }
}
