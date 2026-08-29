import SwiftUI

struct MonniVy: View {
    @ObservedObject var samtal: Samtal
    @EnvironmentObject private var krediter: Krediter
    @State private var text = ""
    @FocusState private var skriver: Bool

    private let snabbval = [
        ("Jag fastnade här", "Jag har fastnat på den här uppgiften: "),
        ("Förklara enklare", "Kan du förklara det där enklare?"),
        ("Visa ett exempel", "Kan du visa ett liknande exempel med andra siffror?")
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { rulle in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if Gemini.shared.nyckel.isEmpty { NyckelSaknas() }
                            RegelKort()
                            ForEach(samtal.bubblor) { b in
                                BubblaVy(bubbla: b).id(b.id)
                            }
                            if samtal.väntar {
                                HStack(spacing: 5) {
                                    ForEach(0..<3) { _ in Circle().frame(width: 7, height: 7) }
                                }
                                .foregroundStyle(.secondary)
                                .padding(.leading, 4)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: samtal.bubblor.count) {
                        withAnimation { rulle.scrollTo(samtal.bubblor.last?.id, anchor: .bottom) }
                    }
                }

                Divider()
                VStack(spacing: 8) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(snabbval, id: \.0) { val in
                                Button(val.0) { text = val.1; skriver = true }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                            }
                        }
                        .padding(.horizontal)
                    }
                    HStack(alignment: .bottom, spacing: 8) {
                        TextField("Vad har du fastnat på?", text: $text, axis: .vertical)
                            .lineLimit(1...4)
                            .textFieldStyle(.roundedBorder)
                            .focused($skriver)
                        Button {
                            let f = text; text = ""
                            Task { await samtal.fråga(f) }
                        } label: {
                            Image(systemName: "arrow.up").bold()
                                .frame(width: 44, height: 44)
                                .background(Circle().fill(Färg.brand))
                                .foregroundStyle(.white)
                        }
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty || samtal.väntar)
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)
                .background(.bar)
            }
            .navigationTitle("Monni")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { SaldoChip() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ny uppgift") { samtal.börjaOm() }
                }
            }
        }
    }
}

private struct RegelKort: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("🔒 Monni säger aldrig svaret").font(.headline)
            Text("Inte om du ber snällt, inte om du ber tio gånger. Hjälpen kommer i fyra steg och sista steget är alltid ditt.")
                .font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(.secondarySystemBackground)))
    }
}

private struct BubblaVy: View {
    let bubbla: Samtal.Bubbla

    var body: some View {
        switch bubbla.vem {
        case .elev:
            HStack {
                Spacer(minLength: 40)
                Text(bubbla.text)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 18).fill(Färg.brand))
                    .foregroundStyle(.white)
            }
        case .monni:
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Monni").font(.caption.bold()).foregroundStyle(Färg.brandMörk)
                    Text(bubbla.text)
                    if let s = bubbla.steg, let steg = Monni.Steg(rawValue: s) {
                        Text("Hjälpsteg \(s + 1) av 4 · \(steg.namn)")
                            .font(.caption2.bold()).foregroundStyle(.secondary).padding(.top, 2)
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 18).fill(Color(.secondarySystemBackground)))
                Spacer(minLength: 40)
            }
        case .system:
            Text(bubbla.text)
                .font(.footnote).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}
