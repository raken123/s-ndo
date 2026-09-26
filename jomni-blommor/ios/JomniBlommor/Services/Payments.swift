import Foundation
import PassKit
import StoreKit
import StripeApplePay

/// Apple Pay via Stripe. Servern skapar beställningen + PaymentIntent när kunden har
/// godkänt betalningen i Apple Pay-arket, och appen bekräftar sedan betalningen.
final class ApplePayCheckout: NSObject, ApplePayContextDelegate {
    private let makeOrder: () async throws -> CreateOrderResponse
    private var continuation: CheckedContinuation<CreateOrderResponse?, Error>?
    private var created: CreateOrderResponse?

    init(makeOrder: @escaping () async throws -> CreateOrderResponse) {
        self.makeOrder = makeOrder
    }

    static var canPay: Bool { StripeAPI.deviceSupportsApplePay() }

    /// Returnerar skapad beställning, eller nil om kunden avbröt.
    @MainActor
    func pay(totalKr: Int, config: AppConfig) async throws -> CreateOrderResponse? {
        guard let key = config.payments.stripePublishableKey else { throw APIError(message: "Betalningen är inte konfigurerad.") }
        StripeAPI.defaultPublishableKey = key
        let request = StripeAPI.paymentRequest(withMerchantIdentifier: config.payments.appleMerchantId, country: "SE", currency: "SEK")
        request.paymentSummaryItems = [PKPaymentSummaryItem(label: "Jomni Blommor", amount: NSDecimalNumber(value: totalKr))]
        guard let context = STPApplePayContext(paymentRequest: request, delegate: self) else {
            throw APIError(message: "Apple Pay är inte tillgängligt på den här enheten.")
        }
        return try await withCheckedThrowingContinuation { cont in
            self.continuation = cont
            context.presentApplePay()
        }
    }

    func applePayContext(_ context: STPApplePayContext, didCreatePaymentMethod paymentMethod: StripeAPI.PaymentMethod,
                         paymentInformation: PKPayment) async throws -> String {
        let res = try await makeOrder()
        created = res
        guard let secret = res.payment.clientSecret else {
            throw APIError(message: "Betalningen kunde inte startas.")
        }
        return secret
    }

    func applePayContext(_ context: STPApplePayContext, didCompleteWith status: STPApplePayContext.PaymentStatus, error: Error?) {
        switch status {
        case .success:
            continuation?.resume(returning: created)
        case .error:
            continuation?.resume(throwing: error ?? APIError(message: "Betalningen misslyckades."))
        case .userCancellation:
            continuation?.resume(returning: nil)
        @unknown default:
            continuation?.resume(returning: nil)
        }
        continuation = nil
    }
}

/// Jomni Plus som automatiskt förnyad prenumeration i App Store (48 kr/mån).
/// Produkten skapas i App Store Connect med id `se.jomni.blommor.plus.monthly`.
@MainActor
final class PlusStore: ObservableObject {
    @Published var product: Product?
    private var updates: Task<Void, Never>?

    func load(productId: String) async {
        product = try? await Product.products(for: [productId]).first
        if updates == nil {
            updates = Task.detached {
                for await result in Transaction.updates {
                    if case .verified(let tx) = result {
                        _ = try? await PlusStore.send(jws: result.jwsRepresentation)
                        await tx.finish()
                    }
                }
            }
        }
    }

    /// Returnerar uppdaterad användare, eller nil om köpet avbröts.
    func purchase() async throws -> User? {
        guard let product else { throw APIError(message: "Jomni Plus är inte tillgängligt i App Store ännu.") }
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            guard case .verified(let tx) = verification else { throw APIError(message: "Köpet kunde inte verifieras.") }
            let user = try await PlusStore.send(jws: verification.jwsRepresentation)
            await tx.finish()
            return user
        case .userCancelled, .pending:
            return nil
        @unknown default:
            return nil
        }
    }

    @discardableResult
    nonisolated static func send(jws: String) async throws -> User? {
        let res: UserResponse = try await APIClient.shared.request("POST", "/plus/apple", body: ["signedTransaction": jws])
        return res.user
    }
}
