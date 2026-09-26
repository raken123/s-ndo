import BackgroundTasks
import Foundation
import UIKit
import UserNotifications

/// Tidskänsliga notiser till butiksägaren: "Ny beställning – du måste leverera" och
/// påminnelser en timme innan leveransfönstret börjar. Tidskänsliga notiser bryter igenom
/// Fokus-lägen (kräver entitlement com.apple.developer.usernotifications.time-sensitive).
///
/// Två vägar används samtidigt så att inget missas:
///  1. Push från servern (APNs) när en beställning betalas och när det är dags att leverera.
///  2. Lokala notiser som appen själv schemalägger när den hämtar beställningar
///     (i förgrunden och via bakgrundsuppdatering). Samma id som serverns apns-collapse-id
///     gör att samma notis inte ligger dubbelt.
final class NotificationManager: @unchecked Sendable {
    static let shared = NotificationManager()
    private let center = UNUserNotificationCenter.current()

    @discardableResult
    func requestAuthorization() async -> Bool {
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted {
            await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
        }
        return granted
    }

    func timeSensitiveAllowed() async -> Bool {
        let settings = await center.notificationSettings()
        return settings.authorizationStatus == .authorized && settings.timeSensitiveSetting != .disabled
    }

    func uploadDeviceToken(_ token: String) async {
        UserDefaults.standard.set(token, forKey: "apnsToken")
        await registerDeviceIfAdmin()
    }

    func registerDeviceIfAdmin() async {
        guard APIClient.shared.adminToken != nil, let token = UserDefaults.standard.string(forKey: "apnsToken") else { return }
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        let _: OKResponse? = try? await APIClient.shared.request("POST", "/admin/devices", body: ["token": token, "env": env], auth: .admin)
    }

    private func content(title: String, body: String, orderId: String) -> UNMutableNotificationContent {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        c.threadIdentifier = "orders"
        c.userInfo = ["orderId": orderId]
        c.interruptionLevel = .timeSensitive
        c.relevanceScore = 1
        return c
    }

    func notifyNewOrder(_ o: Order) {
        let d = o.delivery
        let when = d.slot != nil ? "\(d.date) kl \(d.slotLabel)" : "\(d.date) (PostNord)"
        let items = o.lines.map { "\($0.qty)× \($0.name)" }.joined(separator: ", ")
        let c = content(title: "Ny beställning #\(o.number) – du måste leverera",
                        body: "\(when) · \(items) · \(d.address), \(d.city)", orderId: o.id)
        center.add(UNNotificationRequest(identifier: "new-\(o.id)", content: c, trigger: nil))
    }

    /// Schemalägger "Dags att leverera" en timme före tidsfönstret för alla aktiva beställningar.
    func scheduleDeliveryReminders(for orders: [Order]) {
        let active = orders.filter { $0.isActive }
        let activeIds = Set(active.map { "deliver-\($0.id)" })
        center.getPendingNotificationRequests { pending in
            let stale = pending.map(\.identifier).filter { $0.hasPrefix("deliver-") && !activeIds.contains($0) }
            self.center.removePendingNotificationRequests(withIdentifiers: stale)
        }
        for o in active {
            guard let deliverBy = o.deliverBy.flatMap(Fmt.iso) else { continue }
            let fireAt = deliverBy.addingTimeInterval(-60 * 60)
            let seconds = fireAt.timeIntervalSinceNow
            guard seconds > 0 else { continue }
            let d = o.delivery
            let c = content(title: "⏰ Dags att leverera #\(o.number)",
                            body: "Kl \(d.slotLabel) till \(d.recipient), \(d.address), \(d.city)", orderId: o.id)
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
            center.add(UNNotificationRequest(identifier: "deliver-\(o.id)", content: c, trigger: trigger))
        }
    }

    func sendTest() {
        let c = UNMutableNotificationContent()
        c.title = "Test: du måste leverera 🌸"
        c.body = "Så här ser en tidskänslig notis från Jomni Blommor ut."
        c.sound = .default
        c.interruptionLevel = .timeSensitive
        center.add(UNNotificationRequest(identifier: "test-\(UUID().uuidString)", content: c,
                                         trigger: UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false)))
    }
}

/// Hämtar beställningar för admin och notifierar om nya.
enum AdminPoller {
    static let taskId = "se.jomni.blommor.orders"
    private static let seenKey = "seenOrderIds"

    @discardableResult
    static func poll() async -> [Order]? {
        guard APIClient.shared.adminToken != nil else { return nil }
        guard let res: OrdersResponse = try? await APIClient.shared.request("GET", "/admin/orders", auth: .admin) else { return nil }
        let defaults = UserDefaults.standard
        let firstRun = defaults.object(forKey: seenKey) == nil
        let seen = Set(defaults.stringArray(forKey: seenKey) ?? [])
        if !firstRun {
            for o in res.orders where o.status == "paid" && !seen.contains(o.id) {
                NotificationManager.shared.notifyNewOrder(o)
            }
        }
        defaults.set(res.orders.map(\.id), forKey: seenKey)
        NotificationManager.shared.scheduleDeliveryReminders(for: res.orders)
        return res.orders
    }

    static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            schedule()
            let work = Task {
                await poll()
                task.setTaskCompleted(success: true)
            }
            task.expirationHandler = { work.cancel() }
        }
    }

    static func schedule() {
        guard APIClient.shared.adminToken != nil else { return }
        let req = BGAppRefreshTaskRequest(identifier: taskId)
        req.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(req)
    }
}
