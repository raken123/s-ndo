import Foundation

/// Fem miljoner gratis. Det är inga pengar som byter ägare — det är en budget
/// som gör kostnaden för varje fråga synlig.
///
/// En enda instans, för både chatten och vyerna drar ur samma saldo. Två
/// instanser hade betytt att siffran i topbaren inte rörde sig när Monni
/// svarade.
@MainActor
final class Krediter: ObservableObject {
    static let delad = Krediter()

    static let start = 5_000_000
    static let input = 80
    static let output = 300

    struct Rad: Codable, Identifiable {
        var id: Date { tid }
        let sort: String
        let kostnad: Int
        let notis: String
        let tid: Date
    }

    @Published private(set) var saldo: Int
    @Published private(set) var logg: [Rad]

    private let lager = UserDefaults.standard

    init() {
        saldo = lager.object(forKey: "credits") as? Int ?? Self.start
        logg = (lager.data(forKey: "creditLog")).flatMap {
            try? JSONDecoder().decode([Rad].self, from: $0)
        } ?? []
    }

    func harRåd(_ sort: String) -> Bool {
        saldo >= (sort == "out" ? Self.output : Self.input)
    }

    @discardableResult
    func dra(_ sort: String, _ notis: String) -> Bool {
        let kostnad = sort == "out" ? Self.output : Self.input
        guard saldo >= kostnad else { return false }
        saldo -= kostnad
        logg.insert(Rad(sort: sort, kostnad: kostnad, notis: notis, tid: Date()), at: 0)
        logg = Array(logg.prefix(60))
        spara()
        return true
    }

    func återställ() {
        saldo = Self.start
        logg = []
        spara()
    }

    private func spara() {
        lager.set(saldo, forKey: "credits")
        lager.set(try? JSONEncoder().encode(logg), forKey: "creditLog")
    }

    static func fmt(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00a0}"
        return f.string(from: NSNumber(value: n)) ?? String(n)
    }
}
