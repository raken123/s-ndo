import Foundation
import SandoKarna

/// Nätanropen. Samma väg som Android-appen: nyckeln som ?key=, tidsgräns på
/// varje anrop, och arbetsboken som fileData-del i varje fråga.
///
/// Tänkandet är avstängt med flit. gemini-3.5-flash tänker innan den svarar och
/// tanken ryms i samma maxOutputTokens som svaret — uppmätt åt den 862 av 900
/// tokens och lämnade 34 till svaret, som därmed höggs av mitt i en mening.
/// En knuff behöver ingen tankekedja, och det eleven betalar för ska vara det
/// eleven ser.
actor Gemini {
    static let shared = Gemini()

    private let bas = URL(string: "https://generativelanguage.googleapis.com")!

    nonisolated var nyckel: String {
        get { UserDefaults.standard.string(forKey: "gemini.key") ?? "" }
        set { UserDefaults.standard.set(newValue.trimmingCharacters(in: .whitespaces), forKey: "gemini.key") }
    }
    nonisolated var modell: String {
        get { UserDefaults.standard.string(forKey: "gemini.model") ?? "gemini-3.5-flash" }
        set { UserDefaults.standard.set(newValue, forKey: "gemini.model") }
    }

    enum Fel: LocalizedError {
        case ingenNyckel
        case google(String)
        case tomt(String)
        case nät(String)

        var errorDescription: String? {
            switch self {
            case .ingenNyckel: return "Ingen API-nyckel inlagd — lägg in den under Mer."
            case .google(let m): return "Google svarade: \(m)"
            case .tomt(let orsak): return "Monni svarade inget (\(orsak))."
            case .nät(let m): return "Kunde inte nå Monni: \(m)"
            }
        }
    }

    struct Dokument: Codable, Identifiable, Equatable {
        let id: String
        let namn: String
        let uri: String
        let mime: String
        let storlek: Int
        let gårUt: Date?
    }

    // MARK: - dokument

    nonisolated func dokument() -> [Dokument] {
        guard let d = UserDefaults.standard.data(forKey: "docs"),
              let list = try? JSONDecoder().decode([Dokument].self, from: d) else { return [] }
        return list.filter { ($0.gårUt ?? .distantFuture) > Date() }
    }

    nonisolated func spara(_ list: [Dokument]) {
        if let d = try? JSONEncoder().encode(list) { UserDefaults.standard.set(d, forKey: "docs") }
    }

    nonisolated func aktivBok() -> Dokument? {
        let alla = dokument()
        let id = UserDefaults.standard.string(forKey: "aktivBok")
        return alla.first { $0.id == id } ?? alla.first
    }

    nonisolated func väljBok(_ id: String) {
        UserDefaults.standard.set(id, forKey: "aktivBok")
        Delat.aktivBok = dokument().first { $0.id == id }?.namn
    }

    // MARK: - anropen

    private func json(_ url: URL, metod: String, huvuden: [String: String], kropp: Data?,
                      tidsgräns: TimeInterval) async throws -> [String: Any] {
        var r = URLRequest(url: url)
        r.httpMethod = metod
        r.timeoutInterval = tidsgräns
        huvuden.forEach { r.setValue($0.value, forHTTPHeaderField: $0.key) }
        r.httpBody = kropp
        let data: Data
        do {
            (data, _) = try await URLSession.shared.data(for: r)
        } catch {
            throw Fel.nät(error.localizedDescription)
        }
        guard let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw Fel.nät("oväntat svar från Google")
        }
        if let f = o["error"] as? [String: Any], let m = f["message"] as? String {
            throw Fel.google(m)
        }
        return o
    }

    /// Laddar upp en PDF. Filen ligger hos Google i 48 timmar.
    func laddaUpp(namn: String, data: Data, mime: String) async throws -> Dokument {
        guard !nyckel.isEmpty else { throw Fel.ingenNyckel }
        let url = bas.appending(path: "/upload/v1beta/files")
            .appending(queryItems: [URLQueryItem(name: "key", value: nyckel)])
        let o = try await json(url, metod: "POST", huvuden: [
            "X-Goog-Upload-Protocol": "raw",
            "X-Goog-Upload-File-Name": namn,
            "Content-Type": mime
        ], kropp: data, tidsgräns: 120)

        let f = o["file"] as? [String: Any] ?? [:]
        let dok = Dokument(
            id: "b" + String(Int(Date().timeIntervalSince1970)),
            namn: namn,
            uri: f["uri"] as? String ?? "",
            mime: f["mimeType"] as? String ?? mime,
            storlek: data.count,
            gårUt: (f["expirationTime"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) }
        )
        var alla = dokument()
        alla.insert(dok, at: 0)
        spara(alla)
        väljBok(dok.id)
        return dok
    }

    struct Tur: Codable {
        let role: String
        let text: String
    }

    /// Ett textanrop. Returnerar Monnis råa text — vakten körs av den som frågar.
    func fråga(prompt: String, system: String, historik: [Tur],
               användBok: Bool = true, temperatur: Double = 0.7) async throws -> String {
        guard !nyckel.isEmpty else { throw Fel.ingenNyckel }

        var delar: [[String: Any]] = []
        if användBok, let bok = aktivBok(), !bok.uri.isEmpty {
            delar.append(["fileData": ["mimeType": bok.mime, "fileUri": bok.uri]])
        }
        delar.append(["text": prompt])

        var innehåll: [[String: Any]] = historik.map {
            ["role": $0.role, "parts": [["text": $0.text]]]
        }
        innehåll.append(["role": "user", "parts": delar])

        let kropp: [String: Any] = [
            "contents": innehåll,
            "systemInstruction": ["parts": [["text": system]]],
            "generationConfig": [
                "temperature": temperatur,
                "maxOutputTokens": 2600,
                "responseModalities": ["TEXT"],
                "thinkingConfig": ["thinkingBudget": 0]
            ]
        ]
        let url = bas.appending(path: "/v1beta/models/\(modell):generateContent")
            .appending(queryItems: [URLQueryItem(name: "key", value: nyckel)])
        let o = try await json(url, metod: "POST",
                               huvuden: ["Content-Type": "application/json"],
                               kropp: try JSONSerialization.data(withJSONObject: kropp),
                               tidsgräns: 75)

        let kandidat = (o["candidates"] as? [[String: Any]])?.first ?? [:]
        let parts = (kandidat["content"] as? [String: Any])?["parts"] as? [[String: Any]] ?? []
        var text = parts.compactMap { $0["text"] as? String }.joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let slut = kandidat["finishReason"] as? String ?? "okänd orsak"
        if text.isEmpty { throw Fel.tomt(slut) }
        /* Ett avhugget svar är inte ett svar, och ska inte se ut som ett. */
        if slut == "MAX_TOKENS" {
            text += "\n\n(Här tog utrymmet slut. Fråga vidare så fortsätter jag.)"
        }
        return text
    }

    /// Frågar Google vad nyckeln duger till.
    func testaNyckel() async -> String {
        guard !nyckel.isEmpty else { return "Ingen nyckel inlagd." }
        do {
            let url = bas.appending(path: "/v1beta/models")
                .appending(queryItems: [URLQueryItem(name: "key", value: nyckel)])
            let o = try await json(url, metod: "GET", huvuden: [:], kropp: nil, tidsgräns: 30)
            let n = (o["models"] as? [[String: Any]])?.count ?? 0
            return n > 0 ? "✅ \(n) modeller tillgängliga. Nyckeln fungerar." : "❌ Nyckeln gav inga modeller."
        } catch {
            return "❌ " + error.localizedDescription
        }
    }
}
