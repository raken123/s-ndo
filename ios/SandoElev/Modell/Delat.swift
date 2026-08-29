import Foundation

/// Det telefonen och bilen delar på.
///
/// CarPlay-sidan får **läsa** men aldrig skriva. Att välja arbetsbok, ladda upp
/// en PDF eller ställa en fråga går bara på telefonen — i bilen finns varken
/// filväljare eller tangentbord, och ingen ska sitta och skriva i 90 km/h.
enum Delat {
    static let appgrupp = "group.se.sando.elev"

    private static var lager: UserDefaults {
        UserDefaults(suiteName: appgrupp) ?? .standard
    }

    /// Den senaste knuffen Monni gav, plus frågan den gällde. Det är allt bilen
    /// visar: inget nytt genereras medan någon kör.
    struct Knuff: Codable, Identifiable, Equatable {
        var id: String { tid.description }
        let fråga: String
        let svar: String
        let steg: Int
        let tid: Date

        var stegNamn: String {
            (Monni.Steg(rawValue: steg) ?? .förstå).namn
        }
    }

    private static let nyckel = "knuffar"

    static func knuffar() -> [Knuff] {
        guard let data = lager.data(forKey: nyckel),
              let list = try? JSONDecoder().decode([Knuff].self, from: data) else { return [] }
        return list
    }

    /// Telefonen skriver. Bara de senaste behålls — bilen ska visa en kort
    /// lista, inte ett arkiv.
    static func spara(_ knuff: Knuff) {
        var list = knuffar()
        list.insert(knuff, at: 0)
        list = Array(list.prefix(8))
        if let data = try? JSONEncoder().encode(list) {
            lager.set(data, forKey: nyckel)
        }
    }

    static func rensa() {
        lager.removeObject(forKey: nyckel)
    }

    static var aktivBok: String? {
        get { lager.string(forKey: "aktivBok") }
        set { lager.set(newValue, forKey: "aktivBok") }
    }
}
