import SwiftUI

enum Färg {
    static let brand = Color(red: 0.059, green: 0.482, blue: 0.424)   // #0F7B6C
    static let brandMörk = Color(red: 0.043, green: 0.369, blue: 0.322)
    static let brandMjuk = Color(red: 0.875, green: 0.953, blue: 0.937)
    static let varning = Color(red: 0.961, green: 0.620, blue: 0.043)
}

@MainActor
struct RotVy: View {
    @EnvironmentObject private var krediter: Krediter
    /* Samma kreditinstans som vyerna visar — annars rör sig inte siffran i
       topbaren när Monni svarar. */
    @StateObject private var samtal = Samtal(krediter: .delad)
    @State private var flik = 1

    var body: some View {
        TabView(selection: $flik) {
            BokenVy()
                .tabItem { Label("Boken", systemImage: "book") }
                .tag(0)
            MonniVy(samtal: samtal)
                .tabItem { Label("Monni", systemImage: "bubble.left.and.bubble.right") }
                .tag(1)
            MerVy()
                .tabItem { Label("Mer", systemImage: "gearshape") }
                .tag(2)
        }
        .tint(Färg.brand)
    }
}

/// Rutan som säger vad som saknas i stället för att låta knapparna vara tysta.
struct NyckelSaknas: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("🔑 Lägg in API-nyckeln först").font(.headline)
            Text("Monni behöver en Gemini-nyckel för att svara. Utan den händer ingenting när du frågar. Nyckeln sparas bara på den här telefonen.")
                .font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).strokeBorder(Färg.varning, lineWidth: 2))
    }
}

/// Kreditsaldot i navigationsraden.
struct SaldoChip: View {
    @EnvironmentObject private var krediter: Krediter
    var body: some View {
        Text("💎 " + Krediter.fmt(krediter.saldo))
            .font(.footnote.bold())
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Capsule().fill(Färg.brandMjuk))
            .foregroundStyle(Färg.brandMörk)
    }
}
