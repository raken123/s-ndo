import SwiftUI

struct RootView: View {
    @EnvironmentObject var store: AppStore
    @State private var tab = 0

    var body: some View {
        TabView(selection: $tab) {
            ShopView().tabItem { Label("Buketter", systemImage: "camera.macro") }.tag(0)
            CartView(tab: $tab).tabItem { Label("Varukorg", systemImage: "bag") }.badge(store.cartCount).tag(1)
            RewardsView().tabItem { Label("Belöningar", systemImage: "sparkles") }.tag(2)
            AccountView().tabItem { Label("Konto", systemImage: "person.crop.circle") }.tag(3)
        }
    }
}

struct ShopView: View {
    @EnvironmentObject var store: AppStore
    @State private var category = "Alla"

    private var categories: [String] {
        var cats = ["Alla"]
        for p in store.products where !cats.contains(p.category) { cats.append(p.category) }
        return cats
    }
    private var list: [Bouquet] { store.products.filter { category == "Alla" || $0.category == category } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let err = store.loadError {
                        VStack(spacing: 10) {
                            Text("Butiken är inte nåbar just nu").font(.headline)
                            Text(err).font(.footnote).foregroundStyle(.secondary)
                            Button("Försök igen") { Task { await store.bootstrap() } }.buttonStyle(.borderedProminent)
                        }.frame(maxWidth: .infinity).padding(.vertical, 40)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Handbundna buketter,\nlevererade samma dag.").font(.system(.title, design: .serif).weight(.semibold))
                        Text("Betala med Apple Pay och samla mynt på varje köp.").foregroundStyle(.secondary)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(categories, id: \.self) { c in
                                Button(c) { category = c }
                                    .font(.subheadline.weight(.medium))
                                    .padding(.horizontal, 14).padding(.vertical, 7)
                                    .background(c == category ? Color.primary : Color.jomniSand, in: Capsule())
                                    .foregroundStyle(c == category ? Color(uiColor: .systemBackground) : .primary)
                            }
                        }
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                        ForEach(list) { p in
                            NavigationLink(value: p) { ProductCard(bouquet: p) }.buttonStyle(.plain)
                        }
                    }
                }
                .padding()
            }
            .background(Color.jomniCream)
            .navigationTitle("Jomni Blommor")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Bouquet.self) { ProductDetailView(bouquet: $0) }
            .refreshable { await store.bootstrap() }
        }
    }
}

struct ProductCard: View {
    @EnvironmentObject var store: AppStore
    let bouquet: Bouquet

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            BouquetArt(bouquet: bouquet).padding(10).background(Color.jomniSand, in: RoundedRectangle(cornerRadius: 14))
            Text(bouquet.name).font(.system(.headline, design: .serif))
            Text("+\(Fmt.number(store.coinsFor(bouquet.price))) 🪙").font(.caption.weight(.semibold)).foregroundStyle(Color.jomniCoin)
            HStack {
                Text(Fmt.kronor(bouquet.price)).font(.subheadline.weight(.bold))
                Spacer()
                Button {
                    store.add(bouquet.id)
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    Image(systemName: "plus").font(.subheadline.weight(.bold)).frame(width: 30, height: 30)
                        .background(Color.jomniRose, in: Circle()).foregroundStyle(.white)
                }
                .accessibilityLabel("Köp \(bouquet.name)")
            }
        }
        .padding(10)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 18))
    }
}

struct ProductDetailView: View {
    @EnvironmentObject var store: AppStore
    let bouquet: Bouquet
    @State private var qty = 1
    @State private var added = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                BouquetArt(bouquet: bouquet).padding(30).background(Color.jomniSand, in: RoundedRectangle(cornerRadius: 22))
                Chip(text: bouquet.category)
                Text(bouquet.name).font(.system(.largeTitle, design: .serif).weight(.semibold))
                Text(Fmt.kronor(bouquet.price)).font(.title2.weight(.bold))
                Text(bouquet.description)
                Text("Du får \(Fmt.number(store.coinsFor(bouquet.price))) 🪙 mynt\((store.user?.plus.active ?? false) ? " (dubbla med Plus ✨)" : "")")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(Color.jomniCoin)
                Stepper("Antal: \(qty)", value: $qty, in: 1...20)
                Button {
                    store.add(bouquet.id, qty: qty)
                    added = true
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } label: {
                    Text(added ? "Tillagd i varukorgen ✓" : "Lägg i varukorgen").frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Leverans").font(.headline)
                    Text("🚲 Budleverans samma dag i valt tidsfönster (09–21)")
                    Text("📦 PostNord Hem till hela Sverige, 1–2 vardagar")
                    Text("💌 Skriv ett personligt kort i kassan")
                }.font(.footnote).padding().frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.jomniSand, in: RoundedRectangle(cornerRadius: 16))
            }.padding()
        }
        .background(Color.jomniCream)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct CartView: View {
    @EnvironmentObject var store: AppStore
    @Binding var tab: Int
    @State private var path: [CartRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if store.cart.isEmpty {
                    VStack(spacing: 12) {
                        Text("🌷").font(.system(size: 60))
                        Text("Varukorgen är tom").font(.headline)
                        Button("Välj bukett") { tab = 0 }.buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(store.cart, id: \.productId) { line in
                            if let p = store.product(line.productId) {
                                HStack(spacing: 12) {
                                    BouquetArt(bouquet: p).frame(width: 56, height: 56)
                                        .background(Color.jomniSand, in: RoundedRectangle(cornerRadius: 12))
                                    VStack(alignment: .leading) {
                                        Text(p.name).font(.headline)
                                        Text(Fmt.kronor(p.price * line.qty)).font(.subheadline).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Stepper("\(line.qty)", value: Binding(get: { line.qty }, set: { store.setQty(p.id, $0) }), in: 0...20)
                                        .fixedSize()
                                }
                            }
                        }
                        .onDelete { idx in idx.map { store.cart[$0].productId }.forEach { store.setQty($0, 0) } }
                        Section {
                            HStack { Text("Summa"); Spacer(); Text(Fmt.kronor(store.subtotal)).bold() }
                            Text("Du får \(Fmt.number(store.coinsFor(store.subtotal))) 🪙 mynt\(store.user == nil ? " (logga in)" : "")")
                                .font(.footnote.weight(.semibold)).foregroundStyle(Color.jomniCoin)
                            NavigationLink("Till kassan", value: CartRoute.checkout)
                                .font(.headline).foregroundStyle(Color.jomniRose)
                        }
                    }
                }
            }
            .navigationTitle("Varukorg")
            .navigationDestination(for: CartRoute.self) { route in
                switch route {
                case .checkout: CheckoutView(path: $path)
                case let .order(id, token): OrderTrackingView(orderId: id, token: token)
                }
            }
        }
    }
}
