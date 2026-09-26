import Foundation
import Security

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Sparar inloggningstokens i nyckelringen.
enum Keychain {
    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ key: String, _ value: String?) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    enum Auth { case none, user, admin }

    let baseURL: URL = {
        let raw = Bundle.main.object(forInfoDictionaryKey: "JomniAPIBaseURL") as? String ?? ""
        return URL(string: raw) ?? URL(string: "http://localhost:8080")!
    }()

    var userToken: String? {
        get { Keychain.get("userToken") }
        set { Keychain.set("userToken", newValue) }
    }

    var adminToken: String? {
        get { Keychain.get("adminToken") }
        set { Keychain.set("adminToken", newValue) }
    }

    func request<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil, auth: Auth = .user) async throws -> T {
        guard let url = URL(string: "/api" + path, relativeTo: baseURL) else { throw APIError(message: "Ogiltig adress.") }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 20
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let token: String? = {
            switch auth {
            case .none: return nil
            case .user: return userToken
            case .admin: return adminToken
            }
        }()
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError(message: "Kunde inte nå Jomni Blommor. Kontrollera din anslutning.")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            if status == 401, auth == .admin { adminToken = nil }
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(message: message ?? "Något gick fel (\(status)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum Fmt {
    static let kr: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return f
    }()

    static func kronor(_ n: Int) -> String { "\(kr.string(from: NSNumber(value: n)) ?? "\(n)") kr" }

    static func number(_ d: Double, digits: Int = 3) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.numberStyle = .decimal
        f.maximumFractionDigits = digits
        return f.string(from: NSNumber(value: d)) ?? "\(d)"
    }

    static let day: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/Stockholm")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func prettyDay(_ s: String) -> String {
        guard let d = day.date(from: s) else { return s }
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.timeZone = TimeZone(identifier: "Europe/Stockholm")
        f.dateFormat = "EEEE d MMMM"
        return f.string(from: d).capitalized(with: Locale(identifier: "sv_SE"))
    }

    static func iso(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    static func time(_ s: String) -> String {
        guard let d = iso(s) else { return s }
        let f = DateFormatter()
        f.locale = Locale(identifier: "sv_SE")
        f.dateFormat = "d MMM HH:mm"
        return f.string(from: d)
    }
}
