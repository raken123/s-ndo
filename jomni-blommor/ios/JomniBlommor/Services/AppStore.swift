import Foundation
import SwiftUI

@MainActor
final class AppStore: ObservableObject {
    @Published var config: AppConfig?
    @Published var products: [Bouquet] = []
    @Published var user: User?
    @Published var cart: [CartLine] = [] { didSet { saveCart() } }
    @Published var isAdmin = APIClient.shared.adminToken != nil
    @Published var loadError: String?
    @Published var pendingDiscountCode = ""
    @Published var savedOrders: [SavedOrderRef] = []

    let plusStore = PlusStore()
    private let api = APIClient.shared

    init() {
        if let data = UserDefaults.standard.data(forKey: "cart"), let c = try? JSONDecoder().decode([CartLine].self, from: data) {
            cart = c
        }
        if let data = UserDefaults.standard.data(forKey: "savedOrders"), let s = try? JSONDecoder().decode([SavedOrderRef].self, from: data) {
            savedOrders = s
        }
    }

    func bootstrap() async {
        do {
            async let c: AppConfig = api.request("GET", "/config", auth: .none)
            async let p: ProductsResponse = api.request("GET", "/products", auth: .none)
            config = try await c
            products = try await p.products
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
        await refreshUser()
        if let id = config?.plus.appleProductId { await plusStore.load(productId: id) }
        if isAdmin {
            await NotificationManager.shared.requestAuthorization()
            await AdminPoller.poll()
        }
    }

    // MARK: Varukorg

    private func saveCart() {
        if let data = try? JSONEncoder().encode(cart) { UserDefaults.standard.set(data, forKey: "cart") }
    }

    func product(_ id: String) -> Bouquet? { products.first { $0.id == id } }

    func add(_ id: String, qty: Int = 1) {
        if let i = cart.firstIndex(where: { $0.productId == id }) {
            cart[i].qty = min(20, cart[i].qty + qty)
        } else {
            cart.append(CartLine(productId: id, qty: qty))
        }
    }

    func setQty(_ id: String, _ qty: Int) {
        if qty <= 0 { cart.removeAll { $0.productId == id } } else if let i = cart.firstIndex(where: { $0.productId == id }) {
            cart[i].qty = min(20, qty)
        }
    }

    var cartCount: Int { cart.reduce(0) { $0 + $1.qty } }
    var subtotal: Int { cart.reduce(0) { $0 + (product($1.productId)?.price ?? 0) * $1.qty } }

    func coinsFor(_ kronor: Int) -> Double {
        guard let l = config?.loyalty else { return 0 }
        let mult = (user?.plus.active ?? false) ? l.plusMultiplier : 1
        return Double(kronor * l.milliCoinsPerKrona * mult) / 1000
    }

    var cartItemsJSON: [[String: Any]] { cart.map { ["productId": $0.productId, "qty": $0.qty] } }

    // MARK: Konto

    func refreshUser() async {
        guard api.userToken != nil else { user = nil; return }
        do {
            let r: UserResponse = try await api.request("GET", "/me")
            user = r.user
        } catch {
            if (error as? APIError)?.message.contains("Logga in") == true { api.userToken = nil; user = nil }
        }
    }

    func login(email: String, password: String) async throws {
        let r: AuthResponse = try await api.request("POST", "/auth/login", body: ["email": email, "password": password], auth: .none)
        api.userToken = r.token
        user = r.user
    }

    func register(name: String, email: String, password: String) async throws {
        let r: AuthResponse = try await api.request("POST", "/auth/register",
                                                   body: ["name": name, "email": email, "password": password], auth: .none)
        api.userToken = r.token
        user = r.user
    }

    func logout() async {
        let _: OKResponse? = try? await api.request("POST", "/auth/logout")
        api.userToken = nil
        user = nil
    }

    func deleteAccount(password: String) async throws {
        let _: OKResponse = try await api.request("DELETE", "/me", body: ["password": password])
        api.userToken = nil
        user = nil
    }

    func myOrders() async throws -> [Order] {
        let r: OrdersResponse = try await api.request("GET", "/me/orders")
        return r.orders
    }

    // MARK: Mynt, diamanter & Plus

    func convert(coins: Double, all: Bool) async throws {
        let body: [String: Any] = all ? ["all": true] : ["coins": coins]
        let r: UserResponse = try await api.request("POST", "/loyalty/convert", body: body)
        user = r.user
    }

    func redeem(_ rewardId: String) async throws -> RedeemResponse {
        let r: RedeemResponse = try await api.request("POST", "/loyalty/redeem", body: ["rewardId": rewardId])
        user = r.user
        pendingDiscountCode = r.code
        return r
    }

    /// App Store-prenumeration när produkten finns, annars demoläge från servern.
    func subscribePlus() async throws -> Bool {
        if plusStore.product != nil {
            guard let u = try await plusStore.purchase() else { return false }
            user = u
            return true
        }
        if config?.payments.mode == "demo" {
            let r: PlusResponse = try await api.request("POST", "/plus/subscribe")
            if let u = r.user { user = u }
            return true
        }
        throw APIError(message: "Jomni Plus är inte tillgängligt i App Store ännu.")
    }

    // MARK: Beställning

    func quote(postcode: String, date: String?) async throws -> Quote {
        var body: [String: Any] = ["postcode": postcode]
        if let date { body["date"] = date }
        return try await api.request("POST", "/delivery/quote", body: body, auth: .user)
    }

    func price(zoneId: String?, discountCode: String) async throws -> Pricing {
        var body: [String: Any] = ["items": cartItemsJSON, "discountCode": discountCode]
        if let zoneId { body["zoneId"] = zoneId }
        return try await api.request("POST", "/cart/price", body: body)
    }

    func createOrder(_ body: [String: Any]) async throws -> CreateOrderResponse {
        try await api.request("POST", "/orders", body: body)
    }

    func demoPay(_ res: CreateOrderResponse, wallet: String) async throws -> Order {
        let r: OrderResponse = try await api.request("POST", "/orders/\(res.order.id)/demo-pay",
                                                     body: ["t": res.trackingToken, "wallet": wallet])
        return r.order
    }

    func confirm(_ res: CreateOrderResponse) async throws -> Order {
        let r: OrderResponse = try await api.request("POST", "/orders/\(res.order.id)/confirm", body: ["t": res.trackingToken])
        return r.order
    }

    func orderPlaced(_ res: CreateOrderResponse) {
        cart = []
        pendingDiscountCode = ""
        savedOrders.insert(SavedOrderRef(id: res.order.id, token: res.trackingToken, number: res.order.number,
                                         date: res.order.delivery.date), at: 0)
        savedOrders = Array(savedOrders.prefix(20))
        if let data = try? JSONEncoder().encode(savedOrders) { UserDefaults.standard.set(data, forKey: "savedOrders") }
        Task { await refreshUser() }
    }

    func order(id: String, token: String) async throws -> Order {
        let t = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token
        let r: OrderResponse = try await api.request("GET", "/orders/\(id)?t=\(t)")
        return r.order
    }

    func rate(id: String, token: String, stars: Int, comment: String) async throws -> Order {
        let r: OrderResponse = try await api.request("POST", "/orders/\(id)/rate",
                                                     body: ["t": token, "stars": stars, "comment": comment])
        return r.order
    }

    // MARK: Admin

    func adminLogin(password: String) async throws {
        let r: TokenResponse = try await api.request("POST", "/admin/login", body: ["password": password], auth: .none)
        api.adminToken = r.token
        isAdmin = true
        await NotificationManager.shared.requestAuthorization()
        await NotificationManager.shared.registerDeviceIfAdmin()
        await AdminPoller.poll()
        AdminPoller.schedule()
    }

    func adminLogout() {
        api.adminToken = nil
        isAdmin = false
        UserDefaults.standard.removeObject(forKey: "seenOrderIds")
    }
}
