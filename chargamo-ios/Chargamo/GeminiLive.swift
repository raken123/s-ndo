import Foundation

/// A live voice + vision conversation with Gemini over the Live API (BidiGenerateContent WebSocket).
/// Microphone audio and camera frames go up, spoken audio comes back.
/// Reconnects by itself (with session resumption) until stop() is called. All state lives on the main thread.
final class GeminiLive {
    var onVoiceLevel: ((Float) -> Void)?

    private static let endpoint =
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"

    private static let systemPrompt =
        "Du är Chargamo, en AI som bor i en magnetisk mobilladdare. " +
        "Du vaknar när mobilen börjar laddas. Du ser användaren genom mobilens kamera och hör dem genom mikrofonen. " +
        "På skärmen syns du bara som två fyrkantiga blå ögon på svart bakgrund. " +
        "Prata svenska om inte användaren pratar ett annat språk. Var varm, lite lekfull och kortfattad: " +
        "oftast en eller två meningar, eftersom allt du säger läses upp. " +
        "Om användaren öppnar Facebook eller TikTok medan mobilen laddar vägrar du vakna i en timme; " +
        "det får du gärna påminna om med glimten i ögat. " +
        "Om mobilen vrids långsamt ett halvt varv somnar du."

    private static let greeting =
        "(Mobilen har precis kopplats till laddaren och du har vaknat. Hälsa kort.)"

    private let apiKey: String
    private let model: String
    private let urlSession = URLSession(configuration: .default)
    private let audio = LiveAudio()
    private var task: URLSessionWebSocketTask?
    private var ready = false
    private var running = false
    private var resumeHandle: String?
    private var retries = 0
    private var greeted = false

    init(apiKey: String, model: String) {
        self.apiKey = apiKey
        self.model = model.hasPrefix("models/") ? model : "models/\(model)"
    }

    func start() {
        running = true
        audio.onMicPCM = { [weak self] pcm in
            self?.sendRealtime("audio", mime: "audio/pcm;rate=16000", data: pcm)
        }
        audio.onLevel = { [weak self] level in self?.onVoiceLevel?(level) }
        do {
            try audio.start()
        } catch {
            print("Chargamo audio failed: \(error)")
        }
        connect()
    }

    func stop() {
        running = false
        ready = false
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        audio.stop()
        urlSession.invalidateAndCancel()
    }

    func sendVideo(_ jpeg: Data) {
        sendRealtime("video", mime: "image/jpeg", data: jpeg)
    }

    private func sendRealtime(_ kind: String, mime: String, data: Data) {
        let message = "{\"realtimeInput\":{\"\(kind)\":{\"mimeType\":\"\(mime)\",\"data\":\"\(data.base64EncodedString())\"}}}"
        DispatchQueue.main.async { [weak self] in
            guard let self, self.ready, let task = self.task else { return }
            task.send(.string(message)) { _ in }
        }
    }

    private func connect() {
        guard running else { return }
        var components = URLComponents(string: Self.endpoint)!
        components.queryItems = [URLQueryItem(name: "key", value: apiKey)]
        let t = urlSession.webSocketTask(with: components.url!)
        t.maximumMessageSize = 16 * 1024 * 1024
        task = t
        t.resume()
        t.send(.string(setupMessage())) { [weak self] error in
            guard let error else { return }
            DispatchQueue.main.async { self?.dropped(t, "\(error)") }
        }
        receive(t)
    }

    private func receive(_ t: URLSessionWebSocketTask) {
        t.receive { [weak self] result in
            DispatchQueue.main.async {
                guard let self, t === self.task else { return }
                switch result {
                case .success(.string(let text)):
                    self.handle(Data(text.utf8))
                    self.receive(t)
                case .success(.data(let data)):
                    self.handle(data)
                    self.receive(t)
                case .success:
                    self.receive(t)
                case .failure(let error):
                    self.dropped(t, "\(error)")
                }
            }
        }
    }

    private func dropped(_ t: URLSessionWebSocketTask, _ why: String) {
        guard t === task else { return }
        print("Chargamo Gemini connection dropped: \(why)")
        ready = false
        task = nil
        guard running else { return }
        let delay = min(30, pow(2, Double(min(retries, 5))))
        retries += 1
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.connect() }
    }

    private func setupMessage() -> String {
        var resumption: [String: Any] = [:]
        if let resumeHandle { resumption["handle"] = resumeHandle }
        let setup: [String: Any] = [
            "model": model,
            "generationConfig": ["responseModalities": ["AUDIO"]],
            "systemInstruction": ["parts": [["text": Self.systemPrompt]]],
            // Audio + video sessions are cut after a couple of minutes without compression.
            "contextWindowCompression": ["slidingWindow": [String: Any]()],
            "sessionResumption": resumption,
        ]
        return Self.json(["setup": setup])
    }

    private func handle(_ data: Data) {
        guard let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }

        if msg["setupComplete"] != nil {
            ready = true
            retries = 0
            if !greeted {
                greeted = true
                task?.send(.string(Self.json(["realtimeInput": ["text": Self.greeting]]))) { _ in }
            }
        }

        if let content = msg["serverContent"] as? [String: Any] {
            if content["interrupted"] as? Bool == true { audio.flush() }
            if let turn = content["modelTurn"] as? [String: Any], let parts = turn["parts"] as? [[String: Any]] {
                for part in parts {
                    guard
                        let inline = part["inlineData"] as? [String: Any],
                        let mime = inline["mimeType"] as? String, mime.hasPrefix("audio/pcm"),
                        let b64 = inline["data"] as? String,
                        let pcm = Data(base64Encoded: b64)
                    else { continue }
                    audio.play(pcm)
                }
            }
        }

        if let update = msg["sessionResumptionUpdate"] as? [String: Any],
           update["resumable"] as? Bool == true,
           let handle = update["newHandle"] as? String, !handle.isEmpty {
            resumeHandle = handle
        }

        if msg["goAway"] != nil, let old = task {
            // The server is about to end this connection: move to a fresh one now.
            ready = false
            task = nil
            old.cancel(with: .normalClosure, reason: nil)
            connect()
        }
    }

    private static func json(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}
