package se.sando.elev.bil;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

import se.sando.elev.BuildConfig;

/**
 * Ingången till bilskärmen.
 *
 * Android Auto startar den här tjänsten, inte MainActivity. Bilen får aldrig
 * se en WebView: den ritar mallar som Google har designat för att kunna läsas
 * på en armslängds avstånd av någon som egentligen tittar på vägen.
 *
 * Vad som går att göra i bilen, och vad som inte gör det
 * -----------------------------------------------------
 * Läsa: vilka Matteplatser som finns i närheten, hur långt bort de är, och
 * vad Monni senast sa. Det är det.
 *
 * Inte svara på frågor, inte fråga något nytt, inte ladda upp en bok. En
 * bilskärm har varken tangentbord eller filväljare, och en tjugosekunders
 * fråga är exakt fel sak att lägga framför någon som kör. Frågorna hör till
 * telefonen, och telefonen ligger i fickan så länge bilen rullar.
 *
 * Skillnaden mot CarPlay: den här går faktiskt att köra. Apple delar bara ut
 * CarPlay-rättigheten till en fast lista kategorier som en studieapp inte
 * finns på. Android Auto kräver ingen sådan rättighet för att köra en app man
 * installerat själv — det räcker att slå på "Okända källor" i Android Autos
 * utvecklarinställningar.
 */
public final class SandoBilTjanst extends CarAppService {

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        if (BuildConfig.DEBUG) {
            /* Under utveckling är skrivbordshuvudenheten värden, och den är
               inte signerad som Google Play-tjänsterna. */
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }
        return new HostValidator.Builder(getApplicationContext())
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build();
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new Session() {
            @NonNull
            @Override
            public Screen onCreateScreen(@NonNull Intent intent) {
                return new StartSkarm(getCarContext());
            }
        };
    }
}
