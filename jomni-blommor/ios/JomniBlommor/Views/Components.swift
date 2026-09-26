import SwiftUI

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }

    static let jomniRose = Color(hex: "#b8475f")
    static let jomniRoseSoft = Color(hex: "#f8e4e8")
    static let jomniCream = Color(hex: "#fbf7f2")
    static let jomniSand = Color(hex: "#f5eee6")
    static let jomniSage = Color(hex: "#5e7f66")
    static let jomniCoin = Color(hex: "#c98a12")
    static let jomniDiamond = Color(hex: "#1f8aa8")
}

/// Samma bukettmotiv som på webben (web/bouquet.js).
struct BouquetArt: View {
    let bouquet: Bouquet

    private static let blooms: [CGPoint] = [
        .init(x: 100, y: 70), .init(x: 70, y: 88), .init(x: 130, y: 88), .init(x: 85, y: 58), .init(x: 118, y: 56),
        .init(x: 100, y: 100), .init(x: 55, y: 70), .init(x: 145, y: 70), .init(x: 100, y: 42),
    ]
    private static let leaves: [(Double, CGFloat, CGFloat)] = [(-38, 60, 92), (38, 140, 92), (-65, 48, 70), (65, 152, 70), (-15, 78, 50), (15, 122, 50)]

    var body: some View {
        Canvas { ctx, size in
            let s = min(size.width, size.height) / 200
            ctx.translateBy(x: (size.width - 200 * s) / 2, y: (size.height - 200 * s) / 2)
            ctx.scaleBy(x: s, y: s)
            var seed = UInt64(bouquet.id.unicodeScalars.reduce(UInt32(7)) { $0 &* 31 &+ $1.value })
            func rnd() -> Double {
                seed = (seed &* 6364136223846793005 &+ 1442695040888963407)
                return Double((seed >> 33) % 1000) / 1000
            }
            let leaf = Color(hex: bouquet.leaf)
            var stems = Path()
            stems.move(to: .init(x: 60, y: 176)); stems.addLine(to: .init(x: 100, y: 116)); stems.addLine(to: .init(x: 140, y: 176)); stems.closeSubpath()
            ctx.fill(stems, with: .color(leaf.opacity(0.55)))
            for (rot, x, y) in Self.leaves {
                var c = ctx
                c.translateBy(x: x, y: y)
                c.rotate(by: .degrees(rot))
                c.fill(Path(ellipseIn: CGRect(x: -11, y: -30, width: 22, height: 60)), with: .color(leaf.opacity(0.8)))
            }
            for (i, p) in Self.blooms.enumerated() {
                let color = Color(hex: bouquet.colors[i % bouquet.colors.count])
                let px = Double(p.x), py = Double(p.y)
                let r = 13 + rnd() * 5
                let rot = rnd() * 72
                for k in 0..<5 {
                    let a = (rot + Double(k) * 72) * .pi / 180
                    let cx = px + cos(a) * r * 0.55
                    let cy = py + sin(a) * r * 0.55
                    let pr = r * 0.62
                    let petal = Path(ellipseIn: CGRect(x: cx - pr, y: cy - pr, width: pr * 2, height: pr * 2))
                    ctx.fill(petal, with: .color(color))
                    ctx.stroke(petal, with: .color(.black.opacity(0.08)), lineWidth: 1)
                }
                let cr = r * 0.3
                ctx.fill(Path(ellipseIn: CGRect(x: px - cr, y: py - cr, width: cr * 2, height: cr * 2)), with: .color(.black.opacity(0.14)))
            }
            var paper = Path()
            paper.move(to: .init(x: 42, y: 104))
            paper.addLine(to: .init(x: 100, y: 192))
            paper.addLine(to: .init(x: 158, y: 104))
            paper.addQuadCurve(to: .init(x: 42, y: 104), control: .init(x: 100, y: 124))
            ctx.fill(paper, with: .color(Color(hex: bouquet.paper)))
            ctx.stroke(paper, with: .color(.black.opacity(0.1)), lineWidth: 1.5)
            var ribbon = Path()
            ribbon.move(to: .init(x: 86, y: 152))
            ribbon.addQuadCurve(to: .init(x: 114, y: 152), control: .init(x: 100, y: 146))
            ribbon.addLine(to: .init(x: 112, y: 160))
            ribbon.addQuadCurve(to: .init(x: 88, y: 160), control: .init(x: 100, y: 156))
            ribbon.closeSubpath()
            ctx.fill(ribbon, with: .color(Color(hex: bouquet.colors[0]).opacity(0.9)))
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityLabel(bouquet.name)
    }
}

struct Chip: View {
    let text: String
    var color: Color = .jomniSand
    var fg: Color = .primary
    var body: some View {
        Text(text).font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 4)
            .background(color, in: Capsule()).foregroundStyle(fg)
    }
}

struct BalanceCard: View {
    let title: String
    let value: String
    let subtitle: String
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(tint)
            Text(value).font(.system(.title2, design: .serif).weight(.bold)).foregroundStyle(tint).minimumScaleFactor(0.6).lineLimit(1)
            Text(subtitle).font(.caption2).foregroundStyle(tint.opacity(0.8))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct ErrorText: View {
    let message: String?
    var body: some View {
        if let message, !message.isEmpty {
            Text(message).font(.footnote.weight(.medium)).foregroundStyle(.red)
        }
    }
}
