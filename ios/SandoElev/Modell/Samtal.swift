import Foundation
import SwiftUI
import SandoKarna

/// Samtalet med Monni: hjälpsteget, tjatet, historiken och bubblorna.
@MainActor
final class Samtal: ObservableObject {

    struct Bubbla: Identifiable, Codable {
        enum Vem: String, Codable { case elev, monni, system }
        var id = UUID()
        let vem: Vem
        let text: String
        var steg: Int?
        var vaktSlog: Bool = false
    }

    @Published private(set) var bubblor: [Bubbla] = []
    @Published private(set) var steg: Monni.Steg = .förstå
    @Published private(set) var tjat = 0
    @Published private(set) var väntar = false

    private var historik: [Gemini.Tur] = []
    private let krediter: Krediter

    init(krediter: Krediter) {
        self.krediter = krediter
        if Gemini.shared.aktivBok() == nil {
            bubblor = [Bubbla(vem: .monni, text: "Hej! Lägg upp din arbetsbok under Boken så kan jag hjälpa dig med just dina uppgifter. Du kan fråga mig ändå.")]
        } else {
            bubblor = [Bubbla(vem: .monni, text: "Hej! Vad har du fastnat på? Skriv uppgiften, eller vilken sida och nummer den står på.")]
        }
    }

    func börjaOm() {
        bubblor = [Bubbla(vem: .monni, text: "Ny uppgift. Vad har du fastnat på?")]
        steg = .förstå
        tjat = 0
        historik = []
    }

    func fråga(_ text: String) async {
        let elevText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !elevText.isEmpty, !väntar else { return }

        bubblor.append(Bubbla(vem: .elev, text: elevText))
        väntar = true
        defer { väntar = false }

        let tjatade = Monni.berOmSvar(elevText)
        if tjatade { tjat += 1 }
        /* Stegen flyttas fram av riktiga frågor, inte av tjat om facit. */
        if !tjatade, !historik.isEmpty { steg = steg.nästa }

        guard krediter.harRåd("in") else {
            bubblor.append(Bubbla(vem: .system, text: "Krediterna är slut."))
            return
        }
        krediter.dra("in", "Fråga till Monni")

        do {
            let rått = try await Gemini.shared.fråga(
                prompt: elevText,
                system: Monni.systemprompt(steg: steg, tjat: tjat, bok: Gemini.shared.aktivBok()?.namn),
                historik: historik)
            krediter.dra("out", "Svar från Monni")

            let granskat = Monni.vakt(Monni.städa(rått), elevText: elevText)
            bubblor.append(Bubbla(vem: .monni, text: granskat.text, steg: steg.rawValue, vaktSlog: granskat.ändrad))
            if granskat.ändrad {
                bubblor.append(Bubbla(vem: .system, text: "🔒 Svarsvakten tog bort ett färdigt svar ur Monnis text."))
            }
            historik.append(Gemini.Tur(role: "user", text: elevText))
            historik.append(Gemini.Tur(role: "model", text: granskat.text))
            historik = Array(historik.suffix(12))

            /* Bilen visar det här — den genererar aldrig något själv. */
            Delat.spara(Delat.Knuff(fråga: elevText, svar: granskat.text, steg: steg.rawValue, tid: Date()))
        } catch {
            bubblor.append(Bubbla(vem: .system, text: error.localizedDescription))
        }
    }
}
