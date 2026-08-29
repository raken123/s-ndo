import CarPlay
import SandoKarna

/// CarPlay-scenen.
///
/// Det här är den enda delen som inte är SwiftUI, och det går inte att göra
/// något åt: CarPlay ritar inte vyer utan mallar. Appen får beskriva vad som
/// ska stå, bilen bestämmer hur det ser ut. Det är hela poängen med CarPlay —
/// varje app ser likadan ut, så att föraren känner igen sig.
///
/// Två mallar, och ingen av dem tar emot något:
///
///   CPListTemplate        — de senaste knuffarna Monni gett
///   CPInformationTemplate — en knuff, uppslagen
///
/// Här går det inte att fråga något nytt och inte att ladda upp en bok. Det
/// finns varken tangentbord eller filväljare på en bilskärm, och ingenting
/// genereras medan någon kör. Telefonen frågar, bilen visar.
final class CarPlayScenDelegat: UIResponder, CPTemplateApplicationSceneDelegate {

    private var gränssnitt: CPInterfaceController?

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
        gränssnitt = interfaceController
        interfaceController.setRootTemplate(lista(), animated: false, completion: nil)
    }

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        gränssnitt = nil
    }

    // MARK: - mallarna

    private func lista() -> CPListTemplate {
        let knuffar = Delat.knuffar()

        let rader = knuffar.map { knuff -> CPListItem in
            let rad = CPListItem(text: knuff.fråga, detailText: "Hjälpsteg \(knuff.steg + 1) av 4 · \(knuff.stegNamn)")
            rad.handler = { [weak self] _, klar in
                self?.visa(knuff)
                klar()
            }
            return rad
        }

        let mall = CPListTemplate(
            title: Delat.aktivBok ?? "Monni",
            sections: [CPListSection(items: rader, header: "Senaste knuffarna", sectionIndexTitle: nil)])
        mall.emptyViewTitleVariants = ["Inget att visa än"]
        mall.emptyViewSubtitleVariants = [
            "Fråga Monni på telefonen — knuffarna dyker upp här.",
            "Fråga Monni på telefonen först."
        ]
        return mall
    }

    private func visa(_ knuff: Delat.Knuff) {
        /* Svaret radas upp som korta poster i stället för ett textblock. En
           bilskärm får inte bli en läsupplevelse. */
        var poster: [CPInformationItem] = [
            CPInformationItem(title: "Du frågade", detail: knuff.fråga)
        ]
        poster += stycken(knuff.svar).enumerated().map { i, rad in
            CPInformationItem(title: i == 0 ? "Monni" : "", detail: rad)
        }
        poster.append(CPInformationItem(title: "Hjälpsteg",
                                        detail: "\(knuff.steg + 1) av 4 · \(knuff.stegNamn)"))

        let mall = CPInformationTemplate(title: "Monni",
                                         layout: .leading,
                                         items: poster,
                                         actions: [])
        gränssnitt?.pushTemplate(mall, animated: true, completion: nil)
    }

    /// Delar Monnis svar i korta stycken. CarPlay visar ett begränsat antal
    /// poster, så resten kapas hellre än att trängas.
    private func stycken(_ text: String) -> [String] {
        text.components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .prefix(6)
            .map(String.init)
    }
}
