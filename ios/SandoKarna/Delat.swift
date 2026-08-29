import Foundation

/// Det telefonen och bilen delar på.
///
/// CarPlay-sidan får **läsa** men aldrig skriva. Att välja arbetsbok, ladda upp
/// en PDF eller ställa en fråga går bara på telefonen — i bilen finns varken
/// filväljare eller tangentbord, och ingen ska sitta och skriva i 90 km/h.
public enum Delat {
    public static let appgrupp = "group.se.sando.elev"

    private static var lager: UserDefaults {
        UserDefaults(suiteName: appgrupp) ?? .standard
    }

    /// Den senaste knuffen Monni gav, plus frågan den gällde. Det är allt bilen
    /// visar: inget nytt genereras medan någon kör.
    public struct Knuff: Codable, Identifiable, Equatable {
        public var id: String { tid.description }
        public let fråga: String
        public let svar: String
        public let steg: Int
        public let tid: Date

        public init(fråga: String, svar: String, steg: Int, tid: Date) {
            self.fråga = fråga
            self.svar = svar
            self.steg = steg
            self.tid = tid
        }

        public var stegNamn: String {
            (Monni.Steg(rawValue: steg) ?? .förstå).namn
        }
    }

    private static let nyckel = "knuffar"

    public static func knuffar() -> [Knuff] {
        guard let data = lager.data(forKey: nyckel),
              let list = try? JSONDecoder().decode([Knuff].self, from: data) else { return [] }
        return list
    }

    /// Telefonen skriver. Bara de senaste behålls — bilen ska visa en kort
    /// lista, inte ett arkiv.
    public static func spara(_ knuff: Knuff) {
        var list = knuffar()
        list.insert(knuff, at: 0)
        list = Array(list.prefix(8))
        if let data = try? JSONEncoder().encode(list) {
            lager.set(data, forKey: nyckel)
        }
    }

    public static func rensa() {
        lager.removeObject(forKey: nyckel)
    }

    public static var aktivBok: String? {
        get { lager.string(forKey: "aktivBok") }
        set { lager.set(newValue, forKey: "aktivBok") }
    }
}
