import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = .black
        window.rootViewController = MainViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    /// chargamo://penalty – sent by a Shortcuts automation when Facebook or TikTok opens.
    /// chargamo://key/<API key> – replaces the Gemini key.
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard url.scheme == "chargamo" else { return false }
        switch url.host {
        case "penalty":
            if Charging.isCharging { Prefs.startLockout() }
        case "key":
            let key = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            if !key.isEmpty {
                Prefs.apiKey = key
                (window?.rootViewController as? MainViewController)?.keySaved()
            }
        default:
            break
        }
        return true
    }
}
