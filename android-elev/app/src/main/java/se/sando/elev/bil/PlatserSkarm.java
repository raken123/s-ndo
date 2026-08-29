package se.sando.elev.bil;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.model.ParkedOnlyOnClickListener;

import java.util.List;

import se.sando.elev.Delat;

/**
 * Matteplatserna i närheten, som telefonen senast såg dem.
 *
 * Raderna bär en {@link Place} i sin metadata, så bilen kan sätta ut dem på
 * kartan i stället för att bara lista dem. Det är därför appen är registrerad
 * som POI: det den visar i bilen är platser, inte läxor.
 *
 * Att trycka på en plats öppnar ingen fråga. Fem frågor på tjugo sekunder är
 * exakt fel sak att lägga framför någon som kör, och Android Auto skulle inte
 * heller låta oss: listan är läsbar under färd, texten bakom den bara när
 * bilen står still.
 */
public final class PlatserSkarm extends Screen {

    public PlatserSkarm(@NonNull CarContext ctx) {
        super(ctx);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        List<Delat.Plats> platser = Delat.platser(getCarContext());

        if (platser.isEmpty()) {
            return new MessageTemplate.Builder(
                    "Inga platser hittade än. Öppna Sändo Elev i telefonen och tryck "
                            + "\"Leta platser\" — de läggs ut inom 400 meter från där du står.")
                    .setTitle("Matteplatser")
                    .setHeaderAction(Action.BACK)
                    .build();
        }

        /* Bilen bestämmer hur många rader som får plats, inte vi. Gränsen är
           olika i olika bilar och det finns ingen vettig gissning. */
        int tak = getCarContext().getCarService(ConstraintManager.class)
                .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST);

        ItemList.Builder lista = new ItemList.Builder();
        int n = 0;
        for (Delat.Plats p : platser) {
            if (n++ >= tak) break;
            lista.addItem(new Row.Builder()
                    .setTitle(p.namn)
                    .addText(p.klar
                            ? "Klar i dag · " + avstand(p.meter)
                            : avstand(p.meter) + " · nivå " + p.niva + " · 5 frågor")
                    .setMetadata(new Metadata.Builder()
                            .setPlace(new Place.Builder(CarLocation.create(p.lat, p.lon))
                                    .setMarker(new PlaceMarker.Builder()
                                            .setLabel(String.valueOf(p.niva))
                                            .build())
                                    .build())
                            .build())
                    .setOnClickListener(ParkedOnlyOnClickListener.create(
                            () -> getScreenManager().push(new PlatsSkarm(getCarContext(), p))))
                    .build());
        }

        return new ListTemplate.Builder()
                .setTitle("Matteplatser")
                .setHeaderAction(Action.BACK)
                .setSingleList(lista.build())
                .build();
    }

    static String avstand(int meter) {
        if (meter < 1000) return meter + " m";
        return String.format(new java.util.Locale("sv", "SE"), "%.1f km", meter / 1000.0);
    }
}
