import Foundation
import UIKit

/// Persistent app state: the Gemini key and the social-media charging lockout.
enum Prefs {
    static let model = "gemini-3.8-live"
    static let lockoutDuration: TimeInterval = 60 * 60
    static let lockoutChanged = Notification.Name("ChargamoLockoutChanged")

    private static let defaults = UserDefaults.standard

    // Built-in Gemini API key, base64-encoded (the owner chose to keep it in this public repo).
    private static let builtInKey = String(
        data: Data(base64Encoded: "QVEuQWI4Uk42S0VYQ25rNFBadzB2N1N5clNsMGpDb0xvY0doTWsyelhxTDg3R0NnWENDb2c=")!,
        encoding: .utf8
    )!

    static var apiKey: String {
        get {
            if let key = defaults.string(forKey: "api_key"), !key.isEmpty { return key }
            return builtInKey
        }
        set { defaults.set(newValue, forKey: "api_key") }
    }

    static var lockUntil: Date {
        Date(timeIntervalSince1970: defaults.double(forKey: "lock_until"))
    }

    static var isLockedOut: Bool { Date() < lockUntil }

    static func startLockout() {
        defaults.set(Date().addingTimeInterval(lockoutDuration).timeIntervalSince1970, forKey: "lock_until")
        NotificationCenter.default.post(name: lockoutChanged, object: nil)
    }
}

enum Charging {
    static var isCharging: Bool {
        let state = UIDevice.current.batteryState
        return state == .charging || state == .full
    }
}
