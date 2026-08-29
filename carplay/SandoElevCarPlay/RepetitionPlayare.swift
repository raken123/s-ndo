import AVFoundation
import UIKit
import MediaPlayer

/// Spelar upp en repetition: läser frågan, tiger medan eleven svarar, går
/// vidare. Uppläsningen görs med AVSpeechSynthesizer — appen skickar ingen
/// text någonstans och laddar inte ner några ljudfiler.
///
/// OBS: den här filen är skriven men aldrig kompilerad (se ../README.md).
/// Det som framför allt behöver provas på riktig enhet är samspelet mellan
/// synthesizern och Now Playing: en syntetiserad röst har ingen given längd,
/// så positionen nedan är uppskattad ur turernas tidtabell och inte läst ur
/// någon spelare.
final class RepetitionPlayare: NSObject {

    /// Talet går ungefär så här fort med standardrösten. Används bara för att
    /// gissa hur länge en tur varar, så att Now Playing-raden rör sig.
    private static let teckenPerSekund: Double = 13.5

    private let syntes = AVSpeechSynthesizer()
    private var turer: [Tur] = []
    private var index = 0
    private var tystnadstimer: Timer?

    private(set) var spelar = false
    private(set) var repetition: Repetition?
    private(set) var avsnitt: Repetition.Avsnitt?

    /// Kallas när en tur börjar, så att gränssnittet kan följa med.
    var vidTur: ((Tur, Int, Int) -> Void)?

    override init() {
        super.init()
        syntes.delegate = self
        sättUppFjärrkommandon()
    }

    // MARK: - styrning

    func spela(_ rep: Repetition, avsnitt a: Repetition.Avsnitt) {
        stoppa()
        repetition = rep
        avsnitt = a
        turer = a.turer(paus: rep.pausSekunder)
        index = 0
        starta()
        körNästaTur()
    }

    func pausa() {
        guard spelar else { return }
        spelar = false
        syntes.pauseSpeaking(at: .word)
        tystnadstimer?.invalidate()
        uppdateraNowPlaying()
    }

    func fortsätt() {
        guard !spelar, avsnitt != nil else { return }
        spelar = true
        if syntes.isPaused {
            syntes.continueSpeaking()
        } else {
            körNästaTur()
        }
        uppdateraNowPlaying()
    }

    func stoppa() {
        spelar = false
        syntes.stopSpeaking(at: .immediate)
        tystnadstimer?.invalidate()
        tystnadstimer = nil
        index = 0
    }

    /// Hoppa till nästa fråga. Hoppar över tystnaden som hör till den förra.
    func nästaFråga() {
        tystnadstimer?.invalidate()
        syntes.stopSpeaking(at: .immediate)
        while index < turer.count {
            index += 1
            if case .fråga = turer[safe: index] { break }
        }
        körNästaTur()
    }

    /// Tillbaka till frågan innan — det vanligaste man vill i en bil är
    /// "vänta, säg den igen".
    func föregåendeFråga() {
        tystnadstimer?.invalidate()
        syntes.stopSpeaking(at: .immediate)
        var i = index - 1
        var hittade = -1
        while i >= 0 {
            if case .fråga = turer[safe: i] { hittade = i; break }
            i -= 1
        }
        index = max(0, hittade)
        körNästaTur()
    }

    // MARK: - motorn

    private func starta() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [])
            try session.setActive(true)
        } catch {
            NSLog("Sändo Elev: kunde inte starta ljudsessionen: \(error)")
        }
        spelar = true
    }

    private func körNästaTur() {
        guard spelar, index < turer.count else {
            if index >= turer.count { stoppa() }
            uppdateraNowPlaying()
            return
        }
        let tur = turer[index]
        vidTur?(tur, index, turer.count)
        uppdateraNowPlaying()

        switch tur {
        case .tystnad(let sekunder):
            /* Tystnaden är turen. Ingen uppläsning — bara tiden eleven svarar i. */
            tystnadstimer = Timer.scheduledTimer(withTimeInterval: sekunder, repeats: false) { [weak self] _ in
                self?.gåVidare()
            }
        default:
            guard let text = tur.uppläst else { gåVidare(); return }
            let yttrande = AVSpeechUtterance(string: text)
            yttrande.voice = AVSpeechSynthesisVoice(language: repetition?.rost ?? "sv-SE")
            yttrande.postUtteranceDelay = 0.25
            syntes.speak(yttrande)
        }
    }

    private func gåVidare() {
        index += 1
        körNästaTur()
    }

    // MARK: - Now Playing och rattens knappar

    private func sättUppFjärrkommandon() {
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.addTarget { [weak self] _ in self?.fortsätt(); return .success }
        c.pauseCommand.addTarget { [weak self] _ in self?.pausa(); return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let self else { return .commandFailed }
            self.spelar ? self.pausa() : self.fortsätt()
            return .success
        }
        c.nextTrackCommand.addTarget { [weak self] _ in self?.nästaFråga(); return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in self?.föregåendeFråga(); return .success }
        /* Ingen scrubbing: en repetition är inte ett spår man drar i, och en
           förare ska inte behöva sikta på ett reglage. */
        c.changePlaybackPositionCommand.isEnabled = false
    }

    /// Uppskattad längd på en tur. Se kommentaren överst om varför den gissas.
    private func längd(_ tur: Tur) -> Double {
        switch tur {
        case .tystnad(let s): return s
        default:
            guard let t = tur.uppläst else { return 0 }
            return max(1.0, Double(t.count) / Self.teckenPerSekund)
        }
    }

    private func uppdateraNowPlaying() {
        guard let rep = repetition, let a = avsnitt else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        let total = turer.reduce(0.0) { $0 + längd($1) }
        let hittills = turer.prefix(index).reduce(0.0) { $0 + längd($1) }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: a.titel,
            MPMediaItemPropertyArtist: rep.titel,
            MPMediaItemPropertyAlbumTitle: rep.bok,
            MPMediaItemPropertyPlaybackDuration: total,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: hittills,
            MPNowPlayingInfoPropertyPlaybackRate: spelar ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyIsLiveStream: false
        ]
        if let bild = UIImage(named: "NowPlayingOmslag") {
            info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: bild.size) { _ in bild }
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}

extension RepetitionPlayare: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didFinish utterance: AVSpeechUtterance) {
        guard spelar else { return }
        gåVidare()
    }
}

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
