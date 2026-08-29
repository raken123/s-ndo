import Foundation

/// En repetition: ett kapitel uppdelat i avsnitt, och varje avsnitt en lista
/// med frågor.
///
/// Notera vad som **inte** finns här: det finns inget fält för svar. Det är
/// inte en förbiseende utan hela poängen. I appen läser en svarsvakt Monnis
/// text innan eleven ser den, och kan byta ut ett facit mot en knuff. I en bil
/// finns ingen sådan väg — ljudet är redan i luften när någon hör det. Därför
/// är regeln flyttad in i datat: en repetition kan inte bära ett svar, ens om
/// någon vill lägga in ett.
struct Repetition: Codable {
    let format: String
    let titel: String
    let underrubrik: String
    let bok: String
    let rost: String
    let pausSekunder: Double
    let avsnitt: [Avsnitt]

    struct Avsnitt: Codable, Identifiable {
        let id: String
        let titel: String
        let sidor: String
        let frågor: [String]

        var antalFrågor: Int { frågor.count }

        /// "8 frågor · s. 42–45" — raden under titeln i listan.
        var beskrivning: String {
            "\(antalFrågor) \(antalFrågor == 1 ? "fråga" : "frågor") · s. \(sidor)"
        }
    }

    static let formatVersion = "sandoelev.repet/1"

    /// Läser en repetition ur en JSON-fil och vägrar det den inte känner igen.
    /// En okänd formatversion är ett fel, inte något att gissa sig igenom.
    static func läs(från url: URL) throws -> Repetition {
        let rep = try JSONDecoder().decode(Repetition.self, from: Data(contentsOf: url))
        guard rep.format == formatVersion else {
            throw Fel.oväntatFormat(rep.format)
        }
        guard !rep.avsnitt.isEmpty else { throw Fel.tom }
        return rep
    }

    enum Fel: LocalizedError {
        case oväntatFormat(String)
        case tom

        var errorDescription: String? {
            switch self {
            case .oväntatFormat(let f):
                return "Repetitionen är i formatet \(f), appen läser \(Repetition.formatVersion)."
            case .tom:
                return "Repetitionen innehåller inga avsnitt."
            }
        }
    }
}

/// Det som faktiskt spelas upp: en rad turer i tur och ordning.
///
/// Varje fråga följs av en tystnad som eleven fyller själv. Tystnaden är inte
/// en paus i uppspelningen utan en del av spåret — det är i den eleven svarar.
enum Tur {
    case rubrik(String)
    case fråga(nummer: Int, av: Int, text: String)
    case tystnad(sekunder: Double)
    case avslut(String)

    /// Vad som ska läsas upp. Tystnaden säger ingenting, den varar bara.
    var uppläst: String? {
        switch self {
        case .rubrik(let t): return t
        case .fråga(let n, let av, let text): return "Fråga \(n) av \(av). \(text)"
        case .tystnad: return nil
        case .avslut(let t): return t
        }
    }
}

extension Repetition.Avsnitt {
    /// Bygger turordningen för ett avsnitt.
    func turer(paus: Double) -> [Tur] {
        var turer: [Tur] = [.rubrik(titel)]
        for (i, f) in frågor.enumerated() {
            turer.append(.fråga(nummer: i + 1, av: frågor.count, text: f))
            turer.append(.tystnad(sekunder: paus))
        }
        turer.append(.avslut("Slut på avsnittet. Bra jobbat."))
        return turer
    }
}
