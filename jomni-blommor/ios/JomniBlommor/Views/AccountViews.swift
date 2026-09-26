import SwiftUI

struct OrderTrackingView: View {
    @EnvironmentObject var store: AppStore
    let orderId: String
    let token: String
    @State private var order: Order?
    @State private var error: String?
    @State private var stars = 0
    @State private var comment = ""

    private let flow: [(String, String)] = [
        ("paid", "Beställning mottagen"), ("preparing", "Buketten binds"),
        ("out_for_delivery", "På väg"), ("delivered", "Levererad"),
    ]

    var body: some View {
        List {
            if let o = order {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        if o.status == "paid" { Chip(text: "Tack för din beställning! 💐", color: .jomniSage.opacity(0.15), fg: .jomniSage) }
                        Text("Beställning #\(o.number)").font(.system(.title2, design: .serif).weight(.semibold))
                        Text("Status: \(o.statusLabel)").foregroundStyle(.secondary)
                    }
                }
                if o.status != "cancelled" && o.status != "awaiting_payment" {
                    Section("Leveransstatus") {
                        ForEach(flow.indices, id: \.self) { i in
                            let step = flow[i]
                            let entry = o.history.first { $0.status == step.0 }
                            HStack {
                                Image(systemName: entry != nil ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(entry != nil ? Color.jomniSage : .secondary)
                                Text(step.1).foregroundStyle(entry != nil ? .primary : .secondary)
                                Spacer()
                                if let e = entry { Text(Fmt.time(e.at)).font(.caption).foregroundStyle(.secondary) }
                            }
                        }
                    }
                }
                Section("Leverans") {
                    LabeledContent("Dag", value: Fmt.prettyDay(o.delivery.date) + (o.delivery.slot != nil ? " kl \(o.delivery.slotLabel)" : ""))
                    LabeledContent("Till", value: "\(o.delivery.recipient), \(o.delivery.address), \(o.delivery.city)")
                    LabeledContent("Sätt", value: o.delivery.zoneName)
                    if !o.delivery.message.isEmpty { LabeledContent("Kort", value: "”\(o.delivery.message)”") }
                }
                Section("Betalning") {
                    ForEach(o.lines, id: \.productId) { l in LabeledContent("\(l.qty) × \(l.name)", value: Fmt.kronor(l.total)) }
                    LabeledContent("Leverans", value: o.deliveryFee == 0 ? "Gratis" : Fmt.kronor(o.deliveryFee))
                    if let d = o.discount { LabeledContent(d.label, value: "−\(Fmt.kronor(d.amount))") }
                    LabeledContent("Betalt", value: Fmt.kronor(o.total)).bold()
                    if o.coinsEarned > 0 {
                        Text("Du fick \(Fmt.number(o.coinsEarned)) 🪙 mynt\(o.plusBonus ? " (dubbla med Plus ✨)" : "")")
                            .font(.footnote.weight(.semibold)).foregroundStyle(Color.jomniCoin)
                    }
                }
                if o.canRate {
                    Section("Hur blev det?") {
                        HStack {
                            ForEach(1...5, id: \.self) { n in
                                Button { stars = n } label: {
                                    Image(systemName: n <= stars ? "star.fill" : "star").font(.title2).foregroundStyle(.yellow)
                                }.buttonStyle(.plain)
                            }
                        }
                        TextField("Kommentar (valfritt)", text: $comment, axis: .vertical)
                        Button("Skicka betyg") { Task { await rate() } }.disabled(stars == 0)
                    }
                } else if let r = o.rating {
                    Section { Text("Ditt betyg: " + String(repeating: "⭐", count: r.stars)) }
                }
            } else if let error {
                Text(error).foregroundStyle(.red)
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Följ beställning")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task {
            await load()
            while !Task.isCancelled, let o = order, !["delivered", "cancelled"].contains(o.status) {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                await load()
            }
        }
    }

    private func load() async {
        do { order = try await store.order(id: orderId, token: token); error = nil } catch { self.error = error.localizedDescription }
    }

    private func rate() async {
        do {
            order = try await store.rate(id: orderId, token: token, stars: stars, comment: comment)
        } catch { self.error = error.localizedDescription }
    }
}

struct RewardsView: View {
    @EnvironmentObject var store: AppStore
    @State private var coinsText = ""
    @State private var error: String?
    @State private var info: String?

    var body: some View {
        NavigationStack {
            List {
                if let c = store.config {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Varje köp ger mynt. Växla mynt till diamanter och lös in mot gratis buketter och rabatter.")
                                .font(.subheadline).foregroundStyle(.secondary)
                            HStack {
                                Chip(text: "150 kr = \(Fmt.number(c.loyalty.coinsPer150Kr)) 🪙")
                                Chip(text: "20 🪙 = \(Fmt.number(c.loyalty.diamondsPer20Coins)) 💎")
                            }
                            Chip(text: "✨ Plus = \(c.loyalty.plusMultiplier)× mynt")
                        }
                    }
                    if let u = store.user {
                        Section {
                            HStack(spacing: 10) {
                                BalanceCard(title: "Mynt", value: "🪙 \(Fmt.number(u.coins))", subtitle: "", tint: .jomniCoin)
                                BalanceCard(title: "Diamanter", value: "💎 \(Fmt.number(u.diamonds, digits: 4))", subtitle: "", tint: .jomniDiamond)
                            }
                            .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                        }
                        Section("Växla mynt till diamanter") {
                            TextField("Antal mynt (max \(Fmt.number(u.coins)))", text: $coinsText).keyboardType(.decimalPad)
                            let coins = parsed
                            Text("Du får \(Fmt.number(Double(Int((coins * 1000).rounded()) * c.loyalty.microDiamondsPerMilliCoin) / 1e6, digits: 6)) 💎")
                                .font(.footnote).foregroundStyle(.secondary)
                            Button("Växla allt (\(Fmt.number(u.coins)) 🪙)") { Task { await convert(all: true) } }.disabled(u.milliCoins == 0)
                            Button("Växla") { Task { await convert(all: false) } }.disabled(coins <= 0)
                        }
                    } else {
                        Section { Text("Logga in under Konto för att börja samla mynt.") }
                    }
                    Section("Belöningar") {
                        ForEach(c.rewards) { r in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(r.name).font(.headline)
                                    Text("💎 \(Fmt.number(r.cost, digits: 4))").font(.subheadline).foregroundStyle(Color.jomniDiamond)
                                }
                                Spacer()
                                Button("Lös in") { Task { await redeem(r.id) } }
                                    .buttonStyle(.borderedProminent)
                                    .disabled((store.user?.microDiamonds ?? 0) < r.microCost)
                            }
                        }
                        ErrorText(message: error)
                        if let info { Text(info).font(.footnote.weight(.semibold)).foregroundStyle(Color.jomniSage) }
                    }
                    Section {
                        PlusCard()
                    }
                    .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Belöningar")
            .refreshable { await store.refreshUser() }
            .task { await store.refreshUser() }
        }
    }

    private var parsed: Double { Double(coinsText.replacingOccurrences(of: ",", with: ".")) ?? 0 }

    private func convert(all: Bool) async {
        do {
            try await store.convert(coins: parsed, all: all)
            coinsText = ""
            info = "Mynten är växlade till diamanter 💎"
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func redeem(_ id: String) async {
        do {
            let r = try await store.redeem(id)
            info = "\(r.label)! Koden \(r.code) används automatiskt i kassan."
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

struct PlusCard: View {
    @EnvironmentObject var store: AppStore
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("✨ Jomni Plus").font(.system(.title2, design: .serif).weight(.semibold))
            Text("Dubbla mynt på varje köp. \(store.config?.plus.priceKr ?? 48) kr/mån – avsluta när du vill.")
                .foregroundStyle(.white.opacity(0.85))
            if let u = store.user, u.plus.active {
                Text("Du är Plus-medlem! 🎉").bold()
                if let until = u.plus.until.flatMap(Fmt.iso) {
                    Text("\(u.plus.cancelAtPeriodEnd ? "Avslutas" : "Förnyas") \(until.formatted(date: .long, time: .omitted))").font(.footnote)
                }
                if u.plus.source == "apple" {
                    Text("Hantera i Inställningar → ditt namn → Prenumerationer.").font(.caption)
                }
            } else {
                Button {
                    Task {
                        busy = true
                        defer { busy = false }
                        guard store.user != nil else { error = "Logga in under Konto först."; return }
                        do { _ = try await store.subscribePlus(); error = nil } catch { self.error = error.localizedDescription }
                    }
                } label: {
                    Text(store.plusStore.product.map { "Prenumerera – \($0.displayPrice)/mån" } ?? "Prenumerera – \(store.config?.plus.priceKr ?? 48) kr/mån")
                        .bold().frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(.white, in: Capsule()).foregroundStyle(Color(hex: "#7b3148"))
                }
                .disabled(busy)
            }
            if let error { Text(error).font(.footnote).foregroundStyle(Color(hex: "#ffd3dc")) }
        }
        .foregroundStyle(.white)
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Color(hex: "#3a2430"), Color(hex: "#7b3148")], startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 20))
    }
}

struct AccountView: View {
    @EnvironmentObject var store: AppStore
    @State private var registering = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var orders: [Order] = []
    @State private var showAdmin = false

    var body: some View {
        NavigationStack {
            List {
                if let u = store.user {
                    Section {
                        Text("Hej \(u.name)! 🌷").font(.system(.title2, design: .serif).weight(.semibold))
                        HStack(spacing: 10) {
                            BalanceCard(title: "Mynt", value: "🪙 \(Fmt.number(u.coins))", subtitle: "", tint: .jomniCoin)
                            BalanceCard(title: "Diamanter", value: "💎 \(Fmt.number(u.diamonds, digits: 4))", subtitle: "", tint: .jomniDiamond)
                        }
                        if u.plus.active { Chip(text: "✨ Jomni Plus – dubbla mynt", color: .jomniRoseSoft, fg: .jomniRose) }
                    }
                    Section("Mina beställningar") {
                        if orders.isEmpty { Text("Inga beställningar ännu.").foregroundStyle(.secondary) }
                        ForEach(orders) { o in
                            NavigationLink {
                                OrderTrackingView(orderId: o.id, token: o.trackingToken ?? "")
                            } label: {
                                VStack(alignment: .leading) {
                                    Text("#\(o.number) · \(o.lines.map { "\($0.qty)× \($0.name)" }.joined(separator: ", "))")
                                    Text("\(Fmt.prettyDay(o.delivery.date)) · \(o.statusLabel)\(o.canRate ? " · Betygsätt ⭐" : "")")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    if !u.rewards.isEmpty {
                        Section("Mina belöningskoder") {
                            ForEach(u.rewards) { r in
                                HStack { Text(r.label); Spacer(); Text(r.code).font(.system(.body, design: .monospaced)).strikethrough(r.used) }
                            }
                        }
                    }
                    Section { Button("Logga ut", role: .destructive) { Task { await store.logout() } } }
                } else {
                    Section {
                        Picker("", selection: $registering) {
                            Text("Logga in").tag(false)
                            Text("Skapa konto").tag(true)
                        }.pickerStyle(.segmented)
                        if registering { TextField("Namn", text: $name).textContentType(.name) }
                        TextField("E-post", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                        SecureField("Lösenord (minst 8 tecken)", text: $password).textContentType(registering ? .newPassword : .password)
                        ErrorText(message: error)
                        Button(registering ? "Skapa konto" : "Logga in") { Task { await auth() } }.bold()
                    } footer: {
                        Text("Med ett konto samlar du 🪙 mynt på varje köp och kan växla dem till 💎 diamanter.")
                    }
                    if !store.savedOrders.isEmpty {
                        Section("Beställningar från den här telefonen") {
                            ForEach(store.savedOrders) { ref in
                                NavigationLink("#\(ref.number) · \(Fmt.prettyDay(ref.date))") { OrderTrackingView(orderId: ref.id, token: ref.token) }
                            }
                        }
                    }
                }

                // Adminknappen ligger längst ner.
                Section {
                    Button {
                        showAdmin = true
                    } label: {
                        Label(store.isAdmin ? "Admin (inloggad)" : "Admin", systemImage: "lock.fill").frame(maxWidth: .infinity)
                    }
                    .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Konto")
            .task(id: store.user?.id) { await loadOrders() }
            .refreshable { await store.refreshUser(); await loadOrders() }
            .sheet(isPresented: $showAdmin) { AdminRootView() }
        }
    }

    private func loadOrders() async {
        guard store.user != nil else { orders = []; return }
        orders = (try? await store.myOrders()) ?? []
    }

    private func auth() async {
        do {
            if registering { try await store.register(name: name, email: email, password: password) } else {
                try await store.login(email: email, password: password)
            }
            password = ""
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}
