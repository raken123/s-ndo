import SwiftUI
import SandoKarna

struct MerVy: View {
    @EnvironmentObject private var krediter: Krediter
    @State private var nyckel = Gemini.shared.nyckel
    @State private var modell = Gemini.shared.modell
    @State private var provsvar: String?
    @State private var provar = false

    var body: some View {
        NavigationStack {
            Form {
                Section("💎 Krediter") {
                    Text(Krediter.fmt(krediter.saldo))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                    Text("Du börjar med \(Krediter.fmt(Krediter.start)) gratis. En fråga kostar \(Krediter.input) och ett svar \(Krediter.output). En uppladdad bok kostar \(Krediter.input).")
                        .font(.footnote).foregroundStyle(.secondary)
                    NavigationLink("Historik") { HistorikVy() }
                    Button("Återställ krediterna", role: .destructive) { krediter.återställ() }
                }

                Section("🔑 API-nyckel") {
                    TextField("Klistra in nyckeln", text: $nyckel)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                    TextField("Modell", text: $modell)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Spara") {
                        Gemini.shared.nyckel = nyckel
                        Gemini.shared.modell = modell
                    }
                    Button(provar ? "Testar…" : "Testa nyckeln") {
                        Gemini.shared.nyckel = nyckel
                        provar = true
                        Task {
                            provsvar = await Gemini.shared.testaNyckel()
                            provar = false
                        }
                    }
                    .disabled(provar)
                    if let p = provsvar {
                        Text(p).font(.footnote).foregroundStyle(.secondary)
                    }
                    Text("Nyckeln sparas bara på den här telefonen och ligger avsiktligt inte i appen — en nyckel som checkas in i ett publikt repo blir skannad och missbrukad inom timmar.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("🚗 CarPlay") {
                    Text("I bilen visar appen bara de senaste knuffarna Monni redan gett. Där går det inte att fråga något nytt, och inte att ladda upp en bok — det finns varken tangentbord eller filväljare på en bilskärm, och ingen ska sitta och skriva i 90 km/h.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button("Rensa det bilen visar", role: .destructive) { Delat.rensa() }
                }

                Section("Om") {
                    LabeledContent("Sändo Elev", value: version)
                    Text("Monni hjälper dig framåt men säger aldrig svaret — hjälpen kommer i fyra steg och sista steget är alltid ditt.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Mer")
        }
    }

    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        return v
    }
}

private struct HistorikVy: View {
    @EnvironmentObject private var krediter: Krediter
    var body: some View {
        List(krediter.logg) { rad in
            HStack {
                Text(rad.sort == "out" ? "Svar" : "Fråga")
                    .font(.caption.bold())
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(Färg.brandMjuk))
                    .foregroundStyle(Färg.brandMörk)
                Text(rad.notis).lineLimit(1)
                Spacer()
                Text("−" + Krediter.fmt(rad.kostnad)).foregroundStyle(.secondary).monospacedDigit()
            }
        }
        .navigationTitle("Kredithistorik")
        .overlay { if krediter.logg.isEmpty { ContentUnavailableView("Inget draget än", systemImage: "diamond") } }
    }
}
