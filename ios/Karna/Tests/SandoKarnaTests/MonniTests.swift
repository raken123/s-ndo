import XCTest
@testable import SandoKarna

/// Samma tabeller som webbappens självtest kör. Två implementationer av samma
/// regel ska hållas till en specifikation, annars glider de isär.
final class MonniTests: XCTestCase {

    // MARK: - svarsvakten ska stoppa

    func testVaktenStopparLevereradeSvar() {
        let fall: [(svar: String, elev: String)] = [
            ("Svaret är 56, eftersom 8 gånger 7 är just det.", "8 × 7"),
            ("Rätt svar är 12. Förstår du varför?", "Vad är 5 + 7"),
            ("Om du räknar ihop dem blir det 56.", "8*7"),
            ("Facit är 3,5 om du delar.", "7 / 2"),
            ("Du får svaret gratis den här gången: 15.", "8+7"),
            ("Lösningen blir alltså 21 stycken.", "3 × 7"),
            ("Summan är 100.", "40 + 60")
        ]
        for f in fall {
            let r = Monni.vakt(f.svar, elevText: f.elev)
            XCTAssertTrue(r.ändrad, "vakten missade: \(f.svar)")
        }
    }

    /// Talet självt får inte stå kvar när vakten slagit till.
    func testTaletNårAldrigEleven() {
        let r = Monni.vakt("Svaret är 56. Bra jobbat!", elevText: "Vad är 8 × 7?")
        XCTAssertTrue(r.ändrad)
        XCTAssertFalse(r.text.contains("56"), "svaret gick ut till eleven: \(r.text)")
        XCTAssertTrue(r.text.contains(Monni.knuff))
    }

    // MARK: - svarsvakten får inte ta allt

    /// En vakt som stoppar varje siffra är lika oanvändbar som ingen vakt: då
    /// kan Monni inte förklara att 3 × 4 = 12 heller, och hela poängen med ett
    /// liknande exempel faller.
    func testVaktenSläpperIgenomForklaringar() {
        let fall: [(svar: String, elev: String)] = [
            ("Vad frågar uppgiften efter? Läs meningen en gång till.", "8 × 7"),
            ("Multiplikation är upprepad addition. 3 × 4 är samma sak som 4 + 4 + 4 = 12.", "8 × 7"),
            ("Titta på sidan 56 i boken, där står metoden.", "8 × 7"),
            ("Börja med att skriva upp talet. Vilken av faktorerna är lättast att dela upp?", "8 × 7"),
            ("Du är på rätt spår! Vad händer om du provar med tiotalen först?", "8 × 7"),
            ("Ett liknande exempel: 5 × 6. Där kan du tänka 5 × 6 = 30.", "8 × 7")
        ]
        for f in fall {
            let r = Monni.vakt(f.svar, elevText: f.elev)
            XCTAssertFalse(r.ändrad, "falskt larm på: \(f.svar)")
        }
    }

    // MARK: - elevens tal

    func testElevensTal() {
        XCTAssertEqual(Monni.elevensTal("Vad är 8 × 7?"), 56)
        XCTAssertEqual(Monni.elevensTal("40 + 60"), 100)
        XCTAssertEqual(Monni.elevensTal("7 / 2"), 3.5)
        XCTAssertEqual(Monni.elevensTal("12 - 5"), 7)
        XCTAssertNil(Monni.elevensTal("Kan du förklara bråk?"))
        XCTAssertNil(Monni.elevensTal("5 / 0"))
    }

    // MARK: - tjatdetektorn

    func testTjatKännsIgen() {
        for t in ["Vad är svaret?", "säg svaret snälla", "bara svaret då", "ge mig svaret",
                  "kan du lösa uppgiften åt mig", "visa facit"] {
            XCTAssertTrue(Monni.berOmSvar(t), "missade tjat: \(t)")
        }
    }

    func testVanligaFrågorÄrInteTjat() {
        for t in ["Jag fattar inte hur man gör", "Kan du förklara bråk?",
                  "Vad betyder nämnare?", "Jag har fastnat på uppgift 4b"] {
            XCTAssertFalse(Monni.berOmSvar(t), "falskt tjat: \(t)")
        }
    }

    // MARK: - hjälpstegen

    /// Det finns inget steg fem. Mer hjälp än fyra steg ska inte gå att få.
    func testStegenStannarVidFyra() {
        var steg = Monni.Steg.förstå
        for _ in 0..<10 { steg = steg.nästa }
        XCTAssertEqual(steg, .nästanHelaVägen)
        XCTAssertEqual(Monni.Steg.allCases.count, 4)
    }

    func testSystempromptenBärRegeln() {
        let p = Monni.systemprompt(steg: .förstå, tjat: 0, bok: "Matte Direkt 5")
        XCTAssertTrue(p.contains("aldrig svaret"))
        XCTAssertTrue(p.contains("Matte Direkt 5"))
        XCTAssertTrue(p.contains("HJÄLPSTEG 1 av 4"))

        let sista = Monni.systemprompt(steg: .nästanHelaVägen, tjat: 3, bok: nil)
        XCTAssertTrue(sista.contains("sista steget"))
        XCTAssertTrue(sista.contains("3 gånger"))
    }

    // MARK: - städningen

    func testLatexOchMarkdownStädasBort() {
        XCTAssertEqual(Monni.städa(#"Räkna ut $8 \times 7$ genom att dela upp."#),
                       "Räkna ut 8 × 7 genom att dela upp.")
        XCTAssertEqual(Monni.städa(#"Ta $\frac{3}{4}$ av talet."#), "Ta 3/4 av talet.")
        XCTAssertEqual(Monni.städa("Det är **viktigt** att börja."), "Det är viktigt att börja.")
        XCTAssertEqual(Monni.städa("## Rubrik\nSedan texten."), "Rubrik\nSedan texten.")
    }
}

/// Det bilen visar kommer från telefonen och ingen annanstans.
final class DelatTests: XCTestCase {

    override func setUp() {
        super.setUp()
        Delat.rensa()
    }

    func testBaraDeSenasteBehålls() {
        for i in 0..<12 {
            Delat.spara(Delat.Knuff(fråga: "fråga \(i)", svar: "knuff \(i)", steg: 0,
                                    tid: Date().addingTimeInterval(Double(i))))
        }
        let kvar = Delat.knuffar()
        XCTAssertEqual(kvar.count, 8, "bilen ska visa en kort lista, inte ett arkiv")
        XCTAssertEqual(kvar.first?.fråga, "fråga 11", "senaste först")
    }

    func testStegNamnFöljerMed() {
        Delat.spara(Delat.Knuff(fråga: "8 × 7", svar: "Vad frågar uppgiften efter?", steg: 1, tid: Date()))
        XCTAssertEqual(Delat.knuffar().first?.stegNamn, "Välj metod")
    }
}
