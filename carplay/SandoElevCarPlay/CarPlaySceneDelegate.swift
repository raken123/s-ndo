import CarPlay
import UIKit

/// CarPlay-scenen. Två mallar, inte fler:
///
///   CPListTemplate      — kapitlets avsnitt, ett per rad
///   CPNowPlayingTemplate — den vanliga Spelas nu-vyn, som i vilken ljudapp som helst
///
/// Det är med flit så tunt. En bilskärm konkurrerar med vägen, och allt utom
/// "välj avsnitt" och "play/paus" hör hemma i telefonappen.
///
/// OBS: skriven men aldrig kompilerad — se ../README.md.
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    private var interfaceController: CPInterfaceController?
    private let spelare = RepetitionPlayare()
    private var repetition: Repetition?

    // MARK: - scenens liv

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        interfaceController.setRootTemplate(byggLista(), animated: false, completion: nil)
    }

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        /* Uppspelningen fortsätter när skärmen kopplas bort — det är en ljudapp,
           inte en skärmapp. Den stoppas av föraren, inte av en kontakt. */
        self.interfaceController = nil
    }

    // MARK: - listan

    private func laddaRepetition() -> Repetition? {
        if let r = repetition { return r }
        /* Delad mapp med telefonappen: eleven väljer kapitel där, bilen spelar
           bara upp det som redan är valt. Ingen uppladdning sker härifrån. */
        guard let url = Fillager.senasteRepetition() else { return nil }
        do {
            let r = try Repetition.läs(från: url)
            repetition = r
            return r
        } catch {
            NSLog("Sändo Elev: kunde inte läsa repetitionen: \(error.localizedDescription)")
            return nil
        }
    }

    private func byggLista() -> CPListTemplate {
        guard let rep = laddaRepetition() else { return tomLista() }

        let rader: [CPListItem] = rep.avsnitt.map { avsnitt in
            let rad = CPListItem(text: avsnitt.titel, detailText: avsnitt.beskrivning)
            rad.handler = { [weak self] _, klar in
                self?.spela(avsnitt, ur: rep)
                klar()
            }
            return rad
        }

        let mall = CPListTemplate(title: rep.titel,
                                  sections: [CPListSection(items: rader, header: rep.underrubrik, sectionIndexTitle: nil)])
        mall.emptyViewSubtitleVariants = ["Välj kapitel i appen på telefonen."]
        return mall
    }

    /// Inget valt kapitel. Säger vad som saknas i stället för att visa en tom lista.
    private func tomLista() -> CPListTemplate {
        let mall = CPListTemplate(title: "Repet", sections: [])
        mall.emptyViewTitleVariants = ["Ingen repetition vald"]
        mall.emptyViewSubtitleVariants = [
            "Öppna Sändo Elev på telefonen och välj ett kapitel att repetera."
        ]
        return mall
    }

    // MARK: - uppspelning

    private func spela(_ avsnitt: Repetition.Avsnitt, ur rep: Repetition) {
        spelare.spela(rep, avsnitt: avsnitt)
        let nu = CPNowPlayingTemplate.shared
        nu.isUpNextButtonEnabled = false
        nu.isAlbumArtistButtonEnabled = false
        interfaceController?.pushTemplate(nu, animated: true, completion: nil)
    }
}

/// Var repetitionen ligger. Telefonappen skriver filen, bilen läser den.
enum Fillager {
    /// Appgruppen måste stämma med den i Signing & Capabilities, annars ser
    /// bilen en tom mapp och listan blir tom utan att något ser trasigt ut.
    static let appgrupp = "group.se.sando.elev"

    static func senasteRepetition() -> URL? {
        guard let mapp = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appgrupp) else { return nil }
        let fil = mapp.appendingPathComponent("repet-aktuell.json")
        return FileManager.default.fileExists(atPath: fil.path) ? fil : nil
    }
}
