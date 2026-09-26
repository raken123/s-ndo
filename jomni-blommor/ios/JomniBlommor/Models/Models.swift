import Foundation

// Modeller som speglar serverns JSON (jomni-blommor/server/src/app.js).

struct Bouquet: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let price: Int
    let category: String
    let description: String
    let colors: [String]
    let leaf: String
    let paper: String
}

struct Slot: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let start: Int
    let end: Int
}

struct AppConfig: Codable {
    struct Payments: Codable {
        let mode: String // "stripe" | "demo" | "disabled"
        let stripePublishableKey: String?
        let appleMerchantId: String
    }
    struct Loyalty: Codable {
        let coinsPer150Kr: Double
        let diamondsPer20Coins: Double
        let milliCoinsPerKrona: Int
        let microDiamondsPerMilliCoin: Int
        let plusMultiplier: Int
    }
    struct PlusInfo: Codable {
        let name: String
        let priceKr: Int
        let appleProductId: String
    }
    struct Reward: Codable, Identifiable {
        let id: String
        let name: String
        let cost: Double
        let microCost: Int
    }
    let shop: String
    let payments: Payments
    let slots: [Slot]
    let loyalty: Loyalty
    let plus: PlusInfo
    let rewards: [Reward]
    let today: String
}

struct User: Codable {
    struct Plus: Codable {
        let active: Bool
        let until: String?
        let source: String?
        let cancelAtPeriodEnd: Bool
    }
    struct RewardCode: Codable, Identifiable {
        let code: String
        let label: String
        let used: Bool
        var id: String { code }
    }
    let id: String
    let name: String
    let email: String
    let coins: Double
    let milliCoins: Int
    let diamonds: Double
    let microDiamonds: Int
    let plus: Plus
    let rewards: [RewardCode]
}

struct DeliveryOption: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let fee: Int
    let freeOver: Int?
    let hasSlots: Bool
    let weekdaysOnly: Bool
    let earliestDate: String
    let maxDate: String
    let date: String?
    let slots: [Slot]
}

struct Quote: Codable {
    let postcode: String
    let options: [DeliveryOption]
}

struct Line: Codable, Hashable {
    let productId: String
    let name: String
    let price: Int
    let qty: Int
    let total: Int
}

struct Discount: Codable {
    let code: String
    let type: String
    let amount: Int
    let label: String
}

struct Pricing: Codable {
    let lines: [Line]
    let subtotal: Int
    let discount: Discount?
    let discountError: String?
    let deliveryFee: Int
    let total: Int
    let productTotal: Int
}

struct Order: Codable, Identifiable {
    struct Delivery: Codable {
        let recipient: String
        let city: String
        let postcode: String
        let address: String
        let date: String
        let slot: String?
        let slotLabel: String
        let zoneId: String
        let zoneName: String
        let message: String
        let recipientPhone: String?
        let instructions: String?
    }
    struct Payment: Codable {
        let method: String?
        let paid: Bool?
        let paidAt: String?
    }
    struct HistoryEntry: Codable, Hashable {
        let status: String
        let at: String
        let label: String
    }
    struct Rating: Codable {
        let stars: Int
        let comment: String
    }
    struct Customer: Codable {
        let name: String
        let email: String
        let phone: String
    }
    let id: String
    let number: Int
    let status: String
    let statusLabel: String
    let lines: [Line]
    let subtotal: Int
    let discount: Discount?
    let deliveryFee: Int
    let total: Int
    let delivery: Delivery
    let coinsEarned: Double
    let plusBonus: Bool
    let payment: Payment
    let history: [HistoryEntry]
    let rating: Rating?
    let canRate: Bool
    let createdAt: String
    // Finns bara i vissa svar
    let trackingToken: String?
    let customer: Customer?
    let deliverBy: String?

    var isActive: Bool { ["paid", "preparing", "out_for_delivery"].contains(status) }
}

struct PaymentInfo: Codable {
    let mode: String // "stripe" | "demo" | "free"
    let clientSecret: String?
}

struct CreateOrderResponse: Codable {
    let order: Order
    let trackingToken: String
    let payment: PaymentInfo
}

struct OrderResponse: Codable { let order: Order }
struct OrdersResponse: Codable { let orders: [Order] }
struct ProductsResponse: Codable { let products: [Bouquet] }
struct UserResponse: Codable { let user: User }
struct AuthResponse: Codable { let token: String; let user: User }
struct TokenResponse: Codable { let token: String }
struct RedeemResponse: Codable { let code: String; let label: String; let user: User }
struct PlusResponse: Codable { let user: User?; let checkoutUrl: String? }
struct OKResponse: Codable {}

struct AdminStats: Codable {
    struct Stars: Codable {
        let balance: Int
        let received: Int
        let spent: Int
        let ratings: Int
        let average: Double?
    }
    struct RecentRating: Codable, Identifiable {
        let number: Int
        let name: String
        let stars: Int
        let comment: String
        let at: String
        var id: String { "\(number)" }
    }
    let ordersToday: Int
    let revenueToday: Int
    let revenueTotal: Int
    let toDeliver: Int
    let deliverToday: Int
    let customers: Int
    let plusMembers: Int
    let stars: Stars
    let recentRatings: [RecentRating]
    let pushDevices: Int
    let pushConfigured: Bool
}

struct AdminDiscount: Codable, Identifiable {
    let code: String
    let type: String
    let value: Int
    let maxUses: Int?
    let uses: Int
    let expiresAt: String?
    let starCost: Int?
    let label: String
    let disabled: Bool?
    var id: String { code }
}

struct AdminDiscountsResponse: Codable { let discounts: [AdminDiscount] }
struct CostResponse: Codable { let cost: Int }
struct DeleteDiscountResponse: Codable { let refunded: Int }

struct CartLine: Codable, Hashable {
    let productId: String
    var qty: Int
}

struct SavedOrderRef: Codable, Identifiable {
    let id: String
    let token: String
    let number: Int
    let date: String
}
