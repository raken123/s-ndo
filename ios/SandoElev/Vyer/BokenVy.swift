import SwiftUI
import UniformTypeIdentifiers

struct BokenVy: View {
    @EnvironmentObject private var krediter: Krediter
    @State private var böcker: [Gemini.Dokument] = []
    @State private var aktivId: String?
    @State private var visarVäljare = false
    @State private var valdFil: URL?
    @State private var visarVarning = false
    @State private var läst = false
    @State private var meddelande: String?
    @State private var laddar = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if Gemini.shared.nyckel.isEmpty {
                        NyckelSaknas().listRowInsets(EdgeInsets())
                    }
                    Text("Ladda upp din arbetsbok som PDF. Då kan Monni hjälpa dig med just dina uppgifter, med rätt kapitel och rätt sidor.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }

                if böcker.isEmpty {
                    Section {
                        Text("Ingen bok än. Filen ligger hos Google i 48 timmar och läggs sedan upp på nytt vid behov.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Section("Dina böcker") {
                        ForEach(böcker) { b in
                            Button {
                                Gemini.shared.väljBok(b.id)
                                aktivId = b.id
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(b.namn).foregroundStyle(.primary)
                                        Text(underrad(b)).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if b.id == aktivId {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Färg.brand)
                                    }
                                }
                            }
                        }
                        .onDelete { index in
                            var kvar = böcker
                            kvar.remove(atOffsets: index)
                            Gemini.shared.spara(kvar)
                            ladda()
                        }
                    }
                }

                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("⚠️ Kolla sista sidan i boken först").font(.headline)
                        Text("Många läromedel har ett förbehåll längst bak, där copyright och ISBN står. Står det att materialet inte får användas för att träna AI — ladda inte upp boken.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Färg.varning.opacity(0.12))

                Section {
                    Button {
                        visarVäljare = true
                    } label: {
                        Label(laddar ? "Laddar upp…" : "Ladda upp arbetsbok (PDF)", systemImage: "arrow.up.doc")
                    }
                    .disabled(laddar)
                }
            }
            .navigationTitle("Boken")
            .toolbar { ToolbarItem(placement: .topBarLeading) { SaldoChip() } }
            .fileImporter(isPresented: $visarVäljare, allowedContentTypes: [.pdf]) { resultat in
                switch resultat {
                case .success(let url):
                    valdFil = url
                    läst = false
                    visarVarning = true
                case .failure(let f):
                    meddelande = f.localizedDescription
                }
            }
            /* Frågan ställs vid varje uppladdning, för svaret gäller den
               enskilda boken. Knappen gör ingenting förrän rutan är kryssad. */
            .sheet(isPresented: $visarVarning) {
                SistaSidanVy(filnamn: valdFil?.lastPathComponent ?? "", läst: $läst) {
                    visarVarning = false
                    if let url = valdFil { laddaUpp(url) }
                } avbryt: {
                    visarVarning = false
                    valdFil = nil
                }
            }
            .alert("Uppladdning", isPresented: .constant(meddelande != nil)) {
                Button("OK") { meddelande = nil }
            } message: { Text(meddelande ?? "") }
            .onAppear(perform: ladda)
        }
    }

    private func underrad(_ b: Gemini.Dokument) -> String {
        var delar = ["\(b.storlek / 1024) kB"]
        if let ut = b.gårUt {
            delar.append("\(max(0, Int(ut.timeIntervalSinceNow / 3600))) h kvar hos Google")
        }
        if b.id == aktivId { delar.append("används nu") }
        return delar.joined(separator: " · ")
    }

    private func ladda() {
        böcker = Gemini.shared.dokument()
        aktivId = Gemini.shared.aktivBok()?.id
    }

    private func laddaUpp(_ url: URL) {
        laddar = true
        Task {
            defer { laddar = false }
            let öppnad = url.startAccessingSecurityScopedResource()
            defer { if öppnad { url.stopAccessingSecurityScopedResource() } }
            do {
                let data = try Data(contentsOf: url)
                guard data.count < 18 * 1024 * 1024 else {
                    meddelande = "PDF:en är för stor (max 18 MB)."
                    return
                }
                guard krediter.dra("in", "Uppladdning: " + url.lastPathComponent) else {
                    meddelande = "Krediterna räcker inte till en uppladdning."
                    return
                }
                _ = try await Gemini.shared.laddaUpp(namn: url.lastPathComponent, data: data, mime: "application/pdf")
                ladda()
            } catch {
                meddelande = error.localizedDescription
            }
        }
    }
}

private struct SistaSidanVy: View {
    let filnamn: String
    @Binding var läst: Bool
    let laddaUpp: () -> Void
    let avbryt: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Har du läst sista sidan i boken?").font(.headline)
                        Text("Innan **\(filnamn)** laddas upp: slå upp sista sidan i boken, där copyright och ISBN står.")
                        Text("Står det där att materialet **inte får användas för att träna AI** — eller för maskininlärning, textutvinning eller språkmodeller — ska du inte ladda upp den.")
                        Text("Filen skickas till Google och ligger kvar där i 48 timmar. Uppladdningen kostar \(Krediter.fmt(Krediter.input)) krediter.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    Toggle("Jag har läst sista sidan och det står inget förbud mot AI där.", isOn: $läst)
                }
                Section {
                    Button("Ladda upp", action: laddaUpp).disabled(!läst)
                    Button("Avbryt", role: .cancel, action: avbryt)
                }
            }
            .navigationTitle("📄 " + filnamn)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
