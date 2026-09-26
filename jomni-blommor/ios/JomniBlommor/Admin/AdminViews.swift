import SwiftUI
import UserNotifications

struct AdminRootView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if store.isAdmin { AdminDashboard() } else { AdminLoginView() }
            }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Stäng") { dismiss() } } }
        }
    }
}

struct AdminLoginView: View {
    @EnvironmentObject var store: AppStore
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section {
                SecureField("Lösenord", text: $password).textContentType(.password)
                ErrorText(message: error)
                Button("Logga in") {
                    Task {
                        busy = true
                        defer { busy = false }
                        do { try await store.adminLogin(password: password); password = "" } catch { self.error = error.localizedDescription }
                    }
                }
                .disabled(password.isEmpty || busy)
            } footer: {
                Text("Som admin får du tidskänsliga notiser när en beställning kommer in och när det är dags att leverera.")
            }
        }
        .navigationTitle("🔒 Admin")
    }
}

struct AdminDashboard: View {
    @EnvironmentObject var store: AppStore
    @State private var section = 0
    @State private var orders: [Order] = []
    @State private var stats: AdminStats?
    @State private var error: String?
    @State private var showAll = false
    @State private var notifOK = true

    private let api = APIClient.shared

    var body: some View {
        List {
            if let s = stats {
                Section {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        BalanceCard(title: "Leverera idag", value: "\(s.deliverToday)", subtitle: "\(s.toDeliver) totalt", tint: .jomniRose)
                        BalanceCard(title: "Försäljning idag", value: Fmt.kronor(s.revenueToday), subtitle: "\(s.ordersToday) beställningar", tint: .jomniSage)
                        BalanceCard(title: "Stjärnor", value: "⭐ \(s.stars.balance)",
                                    subtitle: s.stars.average.map { "Snitt \(Fmt.number($0, digits: 1))" } ?? "Inga betyg än", tint: .jomniCoin)
                        BalanceCard(title: "Plus-medlemmar", value: "\(s.plusMembers)", subtitle: "\(s.customers) kunder", tint: .jomniDiamond)
                    }
                    .listRowInsets(EdgeInsets()).listRowBackground(Color.clear)
                }
            }
            if !notifOK {
                Section {
                    Label("Slå på notiser och ”Tidskänsliga notiser” för Jomni Blommor i Inställningar så att du inte missar en leverans.",
                          systemImage: "bell.badge")
                    Button("Öppna Inställningar") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                    }
                }
            }
            Section {
                Picker("", selection: $section) {
                    Text("📦 Beställningar").tag(0)
                    Text("⭐ Stjärnor & rabatter").tag(1)
                }.pickerStyle(.segmented)
            }
            ErrorText(message: error)
            if section == 0 {
                Section {
                    Toggle("Visa levererade/avbrutna", isOn: $showAll)
                }
                let list = orders.filter { showAll || $0.isActive }.sorted { ($0.deliverBy ?? "") < ($1.deliverBy ?? "") }
                if list.isEmpty { Text("Inga beställningar att leverera just nu. 🌿").foregroundStyle(.secondary) }
                ForEach(list) { o in
                    Section { AdminOrderRow(order: o) { status in await update(o, status) } }
                }
            } else if let s = stats {
                StarsSection(stats: s) { await reload() }
            }
            Section {
                Button("Skicka testnotis") { NotificationManager.shared.sendTest() }
                Button("Logga ut från admin", role: .destructive) { store.adminLogout() }
            } footer: {
                Text(stats.map { $0.pushConfigured ? "Push från servern är på (\($0.pushDevices) enheter)." : "Push från servern är inte konfigurerad – appen påminner ändå lokalt." } ?? "")
            }
        }
        .navigationTitle("Jomni Admin")
        .refreshable { await reload() }
        .task {
            notifOK = await NotificationManager.shared.timeSensitiveAllowed()
            while !Task.isCancelled {
                await reload()
                try? await Task.sleep(nanoseconds: 20_000_000_000)
            }
        }
    }

    private func reload() async {
        if let o = await AdminPoller.poll() { orders = o }
        do { stats = try await api.request("GET", "/admin/stats", auth: .admin); error = nil } catch { self.error = error.localizedDescription }
    }

    private func update(_ o: Order, _ status: String) async {
        do {
            let r: OrderResponse = try await api.request("PATCH", "/admin/orders/\(o.id)", body: ["status": status], auth: .admin)
            orders = orders.map { $0.id == r.order.id ? r.order : $0 }
            NotificationManager.shared.scheduleDeliveryReminders(for: orders)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch { self.error = error.localizedDescription }
    }
}

struct AdminOrderRow: View {
    let order: Order
    let setStatus: (String) async -> Void
    @State private var confirmCancel = false

    private var next: (String, String)? {
        switch order.status {
        case "paid": return ("preparing", "Börja binda 💐")
        case "preparing": return ("out_for_delivery", "Ute för leverans 🚲")
        case "out_for_delivery": return ("delivered", "Levererad ✅")
        default: return nil
        }
    }

    var body: some View {
        let d = order.delivery
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("#\(order.number)").font(.headline)
                Chip(text: order.statusLabel)
                Spacer()
                Text(Fmt.kronor(order.total)).font(.subheadline.weight(.semibold))
            }
            Label("\(Fmt.prettyDay(d.date))\(d.slot != nil ? " kl \(d.slotLabel)" : " · PostNord")", systemImage: "clock")
                .font(.subheadline.weight(.semibold)).foregroundStyle(dueColor)
            Text(order.lines.map { "\($0.qty) × \($0.name)" }.joined(separator: ", "))
            VStack(alignment: .leading, spacing: 2) {
                Text("Till: \(d.recipient)").bold()
                if let phone = d.recipientPhone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(phone, destination: url)
                }
                if let url = URL(string: "http://maps.apple.com/?q=" + "\(d.address), \(d.postcode) \(d.city)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!) {
                    Link("\(d.address), \(d.postcode) \(d.city)", destination: url)
                }
                if let i = d.instructions, !i.isEmpty { Text("📝 \(i)").font(.footnote) }
                if !d.message.isEmpty { Text("💌 ”\(d.message)”").font(.footnote).italic() }
            }
            if let c = order.customer {
                Text("Beställare: \(c.name) · \(c.phone) · \(c.email)").font(.caption).foregroundStyle(.secondary)
            }
            if let r = order.rating {
                Text(String(repeating: "⭐", count: r.stars) + " " + r.comment).font(.footnote)
            }
            HStack {
                if let n = next {
                    Button(n.1) { Task { await setStatus(n.0) } }.buttonStyle(.borderedProminent)
                }
                if ["paid", "preparing"].contains(order.status) {
                    Button("Avbryt", role: .destructive) { confirmCancel = true }.buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 4)
        .confirmationDialog("Avbryta beställningen? Glöm inte att återbetala i Stripe.", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Avbryt beställningen", role: .destructive) { Task { await setStatus("cancelled") } }
        }
    }

    private var dueColor: Color {
        guard order.isActive, let due = order.deliverBy.flatMap(Fmt.iso) else { return .primary }
        let left = due.timeIntervalSinceNow
        if left < 0 { return .red }
        if left < 3 * 3600 { return .orange }
        return .primary
    }
}

struct StarsSection: View {
    let stats: AdminStats
    let changed: () async -> Void
    @State private var type = "percent"
    @State private var value = "10"
    @State private var code = ""
    @State private var maxUses = ""
    @State private var cost: Int?
    @State private var error: String?
    @State private var info: String?
    @State private var discounts: [AdminDiscount] = []

    private let api = APIClient.shared

    var body: some View {
        Section("Dina stjärnor") {
            HStack(alignment: .firstTextBaseline) {
                Text("⭐ \(stats.stars.balance)").font(.system(size: 44, weight: .bold, design: .serif)).foregroundStyle(Color.jomniCoin)
                Spacer()
                VStack(alignment: .trailing) {
                    Text("\(stats.stars.received) intjänade").font(.caption)
                    Text("\(stats.stars.spent) använda").font(.caption)
                }.foregroundStyle(.secondary)
            }
            ForEach(stats.recentRatings) { r in
                VStack(alignment: .leading) {
                    Text(String(repeating: "⭐", count: r.stars) + "  #\(r.number) · \(r.name)").font(.subheadline)
                    if !r.comment.isEmpty { Text("”\(r.comment)”").font(.footnote).foregroundStyle(.secondary) }
                }
            }
        }
        Section("Skapa rabatt med stjärnor") {
            Picker("Typ", selection: $type) {
                Text("Procent (1 ⭐/%)").tag("percent")
                Text("Kronor (1 ⭐/10 kr)").tag("amount")
                Text("Gratis leverans (5 ⭐)").tag("free_delivery")
                Text("Gratis bukett (1 ⭐/10 kr)").tag("free_bouquet")
            }
            if type != "free_delivery" {
                TextField("Värde", text: $value).keyboardType(.numberPad)
            }
            TextField("Kod (valfri)", text: $code).textInputAutocapitalization(.characters).autocorrectionDisabled()
            TextField("Max antal användningar (valfritt)", text: $maxUses).keyboardType(.numberPad)
            if let cost {
                Text("Kostar \(cost) ⭐ (du har \(stats.stars.balance) ⭐)").bold()
                    .foregroundStyle(cost > stats.stars.balance ? .red : .primary)
            }
            ErrorText(message: error)
            if let info { Text(info).foregroundStyle(Color.jomniSage).bold() }
            Button("Skapa rabattkod") { Task { await create() } }
        }
        .task(id: "\(type)-\(value)") { await updateCost() }
        Section("Rabattkoder") {
            if discounts.isEmpty { Text("Inga rabattkoder ännu.").foregroundStyle(.secondary) }
            ForEach(discounts) { d in
                VStack(alignment: .leading) {
                    HStack {
                        Text(d.code).font(.system(.body, design: .monospaced).weight(.bold))
                        Text(d.label)
                    }
                    Text("Använd \(d.uses)\(d.maxUses.map { " av \($0)" } ?? "") gånger · \(d.starCost ?? 0) ⭐\(d.disabled == true ? " · inaktiverad" : "")")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .swipeActions {
                    if d.disabled != true {
                        Button("Ta bort", role: .destructive) { Task { await delete(d) } }
                    }
                }
            }
        }
        .task { await loadCodes() }
    }

    private func updateCost() async {
        let r: CostResponse? = try? await api.request("POST", "/admin/discounts/cost", body: ["type": type, "value": Int(value) ?? 0], auth: .admin)
        cost = r?.cost
    }

    private func loadCodes() async {
        let r: AdminDiscountsResponse? = try? await api.request("GET", "/admin/discounts", auth: .admin)
        discounts = r?.discounts ?? []
    }

    private func create() async {
        var body: [String: Any] = ["type": type, "value": Int(value) ?? 0, "code": code]
        if let m = Int(maxUses) { body["maxUses"] = m }
        do {
            let _: OKResponse = try await api.request("POST", "/admin/discounts", body: body, auth: .admin)
            info = "Rabattkoden är skapad! 🎉"
            error = nil
            code = ""
            await changed()
            await loadCodes()
        } catch { self.error = error.localizedDescription; info = nil }
    }

    private func delete(_ d: AdminDiscount) async {
        let r: DeleteDiscountResponse? = try? await api.request("DELETE", "/admin/discounts/\(d.code)", auth: .admin)
        info = (r?.refunded ?? 0) > 0 ? "Koden togs bort och \(r!.refunded) ⭐ kom tillbaka." : "Koden togs bort."
        await changed()
        await loadCodes()
    }
}
