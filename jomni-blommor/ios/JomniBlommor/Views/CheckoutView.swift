import PassKit
import SwiftUI

enum CartRoute: Hashable {
    case checkout
    case order(id: String, token: String)
}

struct CheckoutView: View {
    @EnvironmentObject var store: AppStore
    @Binding var path: [CartRoute]

    @AppStorage("co.name") private var name = ""
    @AppStorage("co.email") private var email = ""
    @AppStorage("co.phone") private var phone = ""
    @State private var postcode = ""
    @State private var quote: Quote?
    @State private var zoneId: String?
    @State private var date = Date()
    @State private var slot: String?
    @State private var recipient = ""
    @State private var recipientPhone = ""
    @State private var address = ""
    @State private var city = ""
    @State private var message = ""
    @State private var instructions = ""
    @State private var discountCode = ""
    @State private var pricing: Pricing?
    @State private var error: String?
    @State private var busy = false
    @State private var applePay: ApplePayCheckout?

    private var option: DeliveryOption? { quote?.options.first { $0.id == zoneId } }
    private var dateString: String { Fmt.day.string(from: date) }
    private var mode: String { store.config?.payments.mode ?? "disabled" }

    var body: some View {
        Form {
            Section("1. Vart ska buketten?") {
                HStack {
                    TextField("Postnummer", text: $postcode).keyboardType(.numberPad).textContentType(.postalCode)
                    Button("Visa") { Task { await loadQuote(date: nil) } }.disabled(postcode.filter(\.isNumber).count != 5)
                }
                if let quote {
                    Picker("Leveranssätt", selection: $zoneId) {
                        ForEach(quote.options) { o in
                            Text("\(o.name) · \(fee(o) == 0 ? "Gratis" : Fmt.kronor(fee(o)))").tag(Optional(o.id))
                        }
                    }
                    .pickerStyle(.inline).labelsHidden()
                    if let o = option {
                        Text(o.description).font(.footnote).foregroundStyle(.secondary)
                        if let min = Fmt.day.date(from: o.earliestDate), let max = Fmt.day.date(from: o.maxDate) {
                            DatePicker("Leveransdag", selection: $date, in: min...max, displayedComponents: .date)
                                .environment(\.locale, Locale(identifier: "sv_SE"))
                        }
                        if o.hasSlots {
                            if o.slots.isEmpty {
                                Text("Inga lediga tider den dagen – välj en annan dag.").foregroundStyle(.red).font(.footnote)
                            } else {
                                Picker("Tidsfönster", selection: $slot) {
                                    ForEach(o.slots) { s in Text(s.label).tag(Optional(s.id)) }
                                }
                                .pickerStyle(.segmented)
                            }
                        } else {
                            Text("PostNord delar ut under dagen, måndag–fredag.").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                TextField("Mottagarens namn", text: $recipient).textContentType(.name)
                TextField("Mottagarens telefon", text: $recipientPhone).keyboardType(.phonePad)
                TextField("Gatuadress (inkl. portkod)", text: $address).textContentType(.fullStreetAddress)
                TextField("Ort", text: $city).textContentType(.addressCity)
                TextField("Hälsning på kortet (valfritt)", text: $message, axis: .vertical).lineLimit(2...4)
                TextField("Instruktion till budet (valfritt)", text: $instructions)
            }

            Section("2. Dina uppgifter") {
                TextField("Ditt namn", text: $name).textContentType(.name)
                TextField("E-post", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never)
                TextField("Telefon", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
                if store.user == nil {
                    Text("Logga in under Konto för att samla mynt på köpet.").font(.footnote).foregroundStyle(.secondary)
                }
            }

            Section("Sammanfattning") {
                if let p = pricing {
                    ForEach(p.lines, id: \.productId) { l in
                        HStack { Text("\(l.qty) × \(l.name)"); Spacer(); Text(Fmt.kronor(l.total)) }
                    }
                    HStack { Text("Leverans"); Spacer(); Text(quote == nil ? "–" : (p.deliveryFee == 0 ? "Gratis" : Fmt.kronor(p.deliveryFee))) }
                    if let d = p.discount {
                        HStack { Text("\(d.label) (\(d.code))"); Spacer(); Text("−\(Fmt.kronor(d.amount))") }.foregroundStyle(Color.jomniSage)
                    }
                    HStack { Text("Att betala").bold(); Spacer(); Text(Fmt.kronor(p.total)).bold() }
                    Text("+\(Fmt.number(store.coinsFor(p.productTotal))) 🪙 mynt").font(.footnote.weight(.semibold)).foregroundStyle(Color.jomniCoin)
                    ErrorText(message: p.discountError)
                }
                HStack {
                    TextField("Rabattkod", text: $discountCode).textInputAutocapitalization(.characters).autocorrectionDisabled()
                    Button("Använd") { Task { await reprice() } }
                }
            }

            Section("3. Betala") {
                ErrorText(message: error)
                if mode == "demo" {
                    Text("🧪 Demoläge – inga riktiga pengar dras.").font(.footnote)
                    PayWithApplePayButton(.buy) { Task { await payDemo(wallet: "apple_pay") } }
                        .frame(height: 48).disabled(busy)
                    Button("Betala med kort (demo)") { Task { await payDemo(wallet: "card") } }.disabled(busy)
                } else if mode == "stripe" {
                    if ApplePayCheckout.canPay {
                        PayWithApplePayButton(.buy) { Task { await payApplePay() } }
                            .frame(height: 48).disabled(busy)
                    } else {
                        Text("Lägg till ett kort i Wallet för att betala med Apple Pay, eller beställ på jomniblommor.se.")
                            .font(.footnote)
                    }
                } else {
                    Text("Betalning är inte aktiverad ännu.").foregroundStyle(.red)
                }
                if busy { ProgressView() }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Kassan")
        .task {
            if discountCode.isEmpty { discountCode = store.pendingDiscountCode }
            if name.isEmpty, let u = store.user { name = u.name; email = u.email }
            await reprice()
        }
        .onChange(of: postcode) { v in if v.filter(\.isNumber).count == 5 { Task { await loadQuote(date: nil) } } }
        .onChange(of: zoneId) { _ in Task { await loadQuote(date: dateString) } }
        .onChange(of: date) { _ in if let q = option?.date, q != dateString { Task { await loadQuote(date: dateString) } } }
    }

    private func fee(_ o: DeliveryOption) -> Int {
        if let free = o.freeOver, store.subtotal >= free { return 0 }
        return o.fee
    }

    private func loadQuote(date wanted: String?) async {
        do {
            let q = try await store.quote(postcode: postcode, date: wanted)
            quote = q
            if !q.options.contains(where: { $0.id == zoneId }) { zoneId = q.options.first?.id }
            if let o = option {
                if let d = o.date.flatMap(Fmt.day.date(from:)), Fmt.day.string(from: d) != dateString { date = d }
                if !o.slots.contains(where: { $0.id == slot }) { slot = o.slots.first?.id }
            }
            error = nil
        } catch {
            quote = nil
            self.error = error.localizedDescription
        }
        await reprice()
    }

    private func reprice() async {
        pricing = try? await store.price(zoneId: quote == nil ? nil : zoneId, discountCode: discountCode)
    }

    private func orderBody(wallet: String) -> [String: Any]? {
        error = nil
        guard let o = option else { error = "Ange postnummer och välj leveranssätt."; return nil }
        if o.hasSlots && slot == nil { error = "Välj ett tidsfönster."; return nil }
        let required = [recipient, recipientPhone, address, city, name, email, phone]
        if required.contains(where: { $0.trimmingCharacters(in: .whitespaces).isEmpty }) {
            error = "Fyll i alla obligatoriska fält."
            return nil
        }
        if pricing?.discountError != nil { error = "Ta bort eller ändra rabattkoden."; return nil }
        return [
            "items": store.cartItemsJSON,
            "discountCode": discountCode,
            "wallet": wallet,
            "customer": ["name": name, "email": email, "phone": phone],
            "delivery": [
                "recipient": recipient, "recipientPhone": recipientPhone, "address": address, "postcode": postcode,
                "city": city, "message": message, "instructions": instructions, "zoneId": o.id, "date": dateString,
                "slot": o.hasSlots ? (slot ?? "") : "",
            ] as [String: Any],
        ]
    }

    private func finish(_ res: CreateOrderResponse) {
        store.orderPlaced(res)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        // Ersätt kassan med spårningssidan.
        path = [.order(id: res.order.id, token: res.trackingToken)]
    }

    private func payDemo(wallet: String) async {
        guard let body = orderBody(wallet: wallet) else { return }
        busy = true
        defer { busy = false }
        do {
            let res = try await store.createOrder(body)
            if res.payment.mode == "demo" { _ = try await store.demoPay(res, wallet: wallet) }
            finish(res)
        } catch { self.error = error.localizedDescription }
    }

    private func payApplePay() async {
        guard let body = orderBody(wallet: "apple_pay"), let config = store.config, let total = pricing?.total else { return }
        busy = true
        defer { busy = false }
        let checkout = ApplePayCheckout { try await store.createOrder(body) }
        applePay = checkout
        do {
            if let res = try await checkout.pay(totalKr: total, config: config) {
                _ = try? await store.confirm(res)
                finish(res)
            }
        } catch { self.error = error.localizedDescription }
        applePay = nil
    }
}
