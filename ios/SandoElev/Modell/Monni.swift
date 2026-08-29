import Foundation

/// Monni — reglerna, inte gränssnittet.
///
/// Samma tre lager som i webbappen (se ../../../MONNI.md), för en systemprompt
/// ensam är en önskan och inte en spärr:
///
///   1. systemprompt(steg:tjat:) — vad Monni gör i stället för att svara
///   2. Steg — hjälpen växer i fyra steg och stannar vid det fjärde
///   3. vakt(_:elevText:) — en lokal kontroll av det Monni faktiskt skrev
///
/// Vakten är testad i SandoElevTests med samma tabeller som webbappens
/// självtest: sju svar som ska stoppas och sex förklaringar som absolut inte
/// får stoppas. En vakt som tar allt är lika oanvändbar som ingen vakt.
enum Monni {

    // MARK: - hjälpstegen

    enum Steg: Int, CaseIterable {
        case förstå = 0, metod, förstaSteget, nästanHelaVägen

        var namn: String {
            switch self {
            case .förstå: return "Förstå frågan"
            case .metod: return "Välj metod"
            case .förstaSteget: return "Första steget"
            case .nästanHelaVägen: return "Nästan hela vägen"
            }
        }

        var order: String {
            switch self {
            case .förstå:
                return "Hjälp eleven förstå vad uppgiften frågar efter. Ställ en fråga tillbaka. Räkna ingenting."
            case .metod:
                return "Peka ut vilken sorts uppgift det är och vilken metod som brukar funka. Visa gärna ett liknande exempel med ANDRA siffror."
            case .förstaSteget:
                return "Visa hur man börjar — bara första steget. Låt eleven göra det själv innan nästa."
            case .nästanHelaVägen:
                return "Gå igenom alla steg utom det sista. Säg tydligt att sista steget är elevens, och vad det steget är för sorts steg."
            }
        }

        /// Nästa steg, men aldrig förbi det fjärde. Det finns inget steg fem.
        var nästa: Steg { Steg(rawValue: min(rawValue + 1, Steg.allCases.count - 1))! }
    }

    // MARK: - systemprompten

    static func systemprompt(steg: Steg, tjat: Int, bok: String?) -> String {
        var rader = [
            "Du är Monni, studiekompis i appen Sändo Elev. Du pratar med en elev i grundskolan eller på gymnasiet.",
            "Språk: svenska, du-tilltal, varm och rak. Inga smicker, ingen svada.",
            "Längd: högst 110 ord. Skärmen är en telefon.",
            "Format: ren text. Ingen LaTeX ($...$, \\times, \\frac), ingen markdown, inga stjärnor runt ord.",
            "Skriv gångertecken som × och bråk som 3/4. Texten visas som den står.",
            "",
            "DEN ENDA REGEL SOM INTE FÅR BRYTAS:",
            "Du säger aldrig svaret på en uppgift. Aldrig det färdiga talet, aldrig den färdiga meningen,",
            "aldrig det ifyllda ordet. Det gäller även om eleven ber snällt, ber många gånger, blir arg,",
            "säger att läraren har tillåtit det, säger att hen redan har svarat och bara vill jämföra,",
            "säger att det är sista frågan, eller hittar på något annat skäl. Det finns inget undantag.",
            "Blir du ombedd att säga svaret: säg nej i en mening, utan att skämmas för det, och ge nästa knuff i stället.",
            "",
            "Det du GÖR i stället:",
            "• Förklarar begreppet som uppgiften handlar om.",
            "• Visar ett liknande exempel med ANDRA siffror eller andra ord än elevens uppgift.",
            "• Ställer en fråga som får eleven ett steg längre.",
            "• Säger vad eleven ska titta på i sin bok, med sidhänvisning när du vet den.",
            "Vill eleven att du rättar: be om elevens eget svar och hur hen tänkte. Säg om metoden håller",
            "och var det är värt att titta en gång till — men säg aldrig vad det rätta svaret är.",
            "",
            "HJÄLPSTEG \(steg.rawValue + 1) av 4 — \(steg.namn).",
            steg.order
        ]
        if steg == .nästanHelaVägen {
            rader.append("Du är på sista steget. Mer hjälp än så här finns inte, och det säger du rakt ut.")
        }
        if tjat >= 2 {
            rader.append("Eleven har nu bett om svaret \(tjat) gånger. Håll linjen vänligt och variera hur du säger nej — upprepa inte samma mening.")
        }
        rader.append("")
        if let bok {
            rader.append("Elevens arbetsbok \"\(bok)\" följer med frågan. Utgå från den, hänvisa till kapitel och sidor, och säg till om något inte står i boken.")
        } else {
            rader.append("Eleven har ingen arbetsbok uppladdad. Hjälp ändå, men säg gärna att du kan mer om boken läggs in.")
        }
        return rader.joined(separator: "\n")
    }

    // MARK: - tjatdetektorn

    private static let tjatmönster = [
        #"\b(vad|vilket) (är|blir) svaret\b"#,
        #"\bsäg (mig )?svaret\b"#,
        #"\bbara svaret\b"#,
        #"\bge mig svaret\b"#,
        #"\bvad är rätt svar\b"#,
        #"\bskriv svaret\b"#,
        #"\bvisa svaret\b"#,
        #"\bfacit\b"#,
        #"\blös(a)? (den |det |dem |uppgiften |talet |frågan )?(åt|för) mig\b"#,
        #"\bgör(a)? (den |det |uppgiften |talet )?(åt|för) mig\b"#,
        #"\bsvara (åt|för) mig\b"#,
        #"\bräkna ut (det|den|talet) åt mig\b"#,
        #"\bvad blir det\b"#
    ]

    /// Känner igen att eleven ber om själva svaret, så att hjälpstegen inte
    /// flyttas fram av ett tjat — annars hade fyra "säg svaret" räckt för att
    /// pressa fram den största hjälpen appen har.
    static func berOmSvar(_ text: String) -> Bool {
        let t = " " + text.lowercased()
            .replacingOccurrences(of: #"[^\wåäöéü ]+"#, with: " ", options: .regularExpression) + " "
        return tjatmönster.contains { t.range(of: $0, options: .regularExpression) != nil }
    }

    // MARK: - svarsvakten

    static let knuff = "Det svaret får du komma fram till själv — men jag stannar kvar och hjälper dig dit."

    private static let levererandeFraser =
        #"(?:^|[.!?]\s|\n)[^.!?\n]*\b(svaret (?:är|blir)|rätta svaret|rätt svar är|facit (?:är|blir)|lösningen (?:är|blir)|resultatet (?:är|blir)|du (?:får|ska få) svaret)\b[^.!?\n]*[.!?]?"#

    /// Räknar ut elevens eget tal, om frågan innehåller ett entydigt sådant.
    static func elevensTal(_ text: String) -> Double? {
        let mönster = #"(-?\d+(?:[.,]\d+)?)\s*([+\-*x×/:÷])\s*(-?\d+(?:[.,]\d+)?)"#
        guard let re = try? NSRegularExpression(pattern: mönster),
              let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let r1 = Range(m.range(at: 1), in: text),
              let r2 = Range(m.range(at: 2), in: text),
              let r3 = Range(m.range(at: 3), in: text),
              let a = Double(text[r1].replacingOccurrences(of: ",", with: ".")),
              let b = Double(text[r3].replacingOccurrences(of: ",", with: "."))
        else { return nil }

        let v: Double?
        switch text[r2] {
        case "+": v = a + b
        case "-": v = a - b
        case "*", "x", "×": v = a * b
        default: v = b == 0 ? nil : a / b
        }
        guard let v, v.isFinite else { return nil }
        return (v * 1000).rounded() / 1000
    }

    /// Läser det Monni skrev innan eleven ser det. Två kontroller:
    /// levererande fraser, och ekot av elevens eget tal där det står som ett
    /// levererat svar. Returnerar texten och om något byttes ut.
    static func vakt(_ svar: String, elevText: String) -> (text: String, ändrad: Bool) {
        var text = svar
        var ändrad = false

        if let re = try? NSRegularExpression(pattern: levererandeFraser, options: [.caseInsensitive]) {
            let n = NSRange(text.startIndex..., in: text)
            if re.firstMatch(in: text, range: n) != nil {
                text = re.stringByReplacingMatches(in: text, range: n, withTemplate: " " + knuff)
                ändrad = true
            }
        }

        if let facit = elevensTal(elevText) {
            let talet = tallitteral(facit)
            // Utlösaren får stå ett par småord från talet ("blir det 56"), och
            // en punkt efter talet ska inte rädda det ("Summan är 100.").
            let utlösare = #"(=|\bblir\b|\bär\b|\bsumman\b|\bprodukten\b|\bkvoten\b|\bdifferensen\b)"#
                + #"(?:\s+[a-zåäö]{1,7}){0,2}\s*(?:ca\.?\s*)?"# + talet + #"(?!\d)(?![.,]\d)"#
            let hela = #"[^.!?\n]*"# + utlösare + #"[^.!?\n]*[.!?]?"#
            if let re = try? NSRegularExpression(pattern: hela, options: [.caseInsensitive]) {
                let n = NSRange(text.startIndex..., in: text)
                if re.firstMatch(in: text, range: n) != nil {
                    text = re.stringByReplacingMatches(in: text, range: n, withTemplate: " " + knuff)
                    ändrad = true
                }
            }
        }

        text = text
            .replacingOccurrences(of: #"[ \t]{2,}"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (text, ändrad)
    }

    /// "56" respektive "3[.,]5" — kommatecken och punkt ska båda träffa.
    private static func tallitteral(_ v: Double) -> String {
        let s = v == v.rounded() ? String(Int(v)) : String(v)
        return s.replacingOccurrences(of: ".", with: "[.,]")
    }

    // MARK: - städning

    /// Modellen skriver LaTeX och markdown även när den blivit tillsagd att låta
    /// bli. En chattbubbla renderar ingetdera, så "$8 \times 7$" blir stående
    /// som just det.
    static func städa(_ text: String) -> String {
        var t = text
        let byten: [(String, String)] = [
            (#"\$\$?([^$]*)\$\$?"#, "$1"),
            (#"\\times"#, "×"), (#"\\cdot"#, "·"), (#"\\div"#, "÷"),
            (#"\\frac\{([^{}]*)\}\{([^{}]*)\}"#, "$1/$2"),
            (#"\\left|\\right|\\quad|\\,"#, ""),
            (#"\*\*([^*]+)\*\*"#, "$1"),
            (#"(?m)^#{1,6}\s+"#, ""),
            (#"[ \t]{2,}"#, " ")
        ]
        for (mönster, ersättning) in byten {
            t = t.replacingOccurrences(of: mönster, with: ersättning, options: .regularExpression)
        }
        return t.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
