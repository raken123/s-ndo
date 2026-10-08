import AVFoundation

/// Microphone in (16 kHz mono PCM, 100 ms chunks) and the AI's voice out (24 kHz mono PCM)
/// through one voice-processing audio engine, so the phone does not hear itself.
final class LiveAudio {
    var onMicPCM: ((Data) -> Void)?
    /// Loudness of what is playing right now, 0...1. Called on the main thread.
    var onLevel: ((Float) -> Void)?

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 24_000, channels: 1, interleaved: false)!
    private let micFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)!
    private var converter: AVAudioConverter?
    private var pending = Data()
    private var levels: [Float] = [] // one per scheduled buffer, main thread only
    private var generation = 0

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
        try session.setActive(true)

        let input = engine.inputNode
        try input.setVoiceProcessingEnabled(true)
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: outFormat)

        let inFormat = input.outputFormat(forBus: 0)
        guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
            throw NSError(domain: "Chargamo", code: 1, userInfo: [NSLocalizedDescriptionKey: "No microphone input"])
        }
        converter = AVAudioConverter(from: inFormat, to: micFormat)
        input.installTap(onBus: 0, bufferSize: 4800, format: inFormat) { [weak self] buffer, _ in
            self?.convertMic(buffer)
        }
        engine.prepare()
        try engine.start()
        player.play()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        player.stop()
        engine.stop()
        levels.removeAll()
        onLevel?(0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Plays 16-bit little-endian PCM at 24 kHz. Call on the main thread.
    func play(_ pcm: Data) {
        let frames = pcm.count / 2
        guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buffer.frameLength = AVAudioFrameCount(frames)
        let dst = buffer.floatChannelData![0]
        var sum: Float = 0
        pcm.withUnsafeBytes { raw in
            for i in 0..<frames {
                let v = Float(Int16(littleEndian: raw.loadUnaligned(fromByteOffset: i * 2, as: Int16.self))) / 32768
                dst[i] = v
                sum += v * v
            }
        }
        let level = min(1, (sum / Float(frames)).squareRoot() * 4)
        let gen = generation
        levels.append(level)
        if levels.count == 1 { onLevel?(level) }
        player.scheduleBuffer(buffer) { [weak self] in
            DispatchQueue.main.async {
                guard let self, gen == self.generation, !self.levels.isEmpty else { return }
                self.levels.removeFirst()
                self.onLevel?(self.levels.first ?? 0)
            }
        }
    }

    /// The user interrupted the AI: drop what it was saying. Call on the main thread.
    func flush() {
        generation += 1
        levels.removeAll()
        player.stop()
        player.play()
        onLevel?(0)
    }

    private func convertMic(_ buffer: AVAudioPCMBuffer) {
        guard let converter else { return }
        let ratio = micFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: micFormat, frameCapacity: capacity) else { return }
        var fed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if fed {
                status.pointee = .noDataNow
                return nil
            }
            fed = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, out.frameLength > 0, let channel = out.int16ChannelData else { return }
        pending.append(Data(bytes: channel[0], count: Int(out.frameLength) * 2))
        let chunk = 3200 // 100 ms at 16 kHz
        while pending.count >= chunk {
            onMicPCM?(Data(pending.prefix(chunk)))
            pending = Data(pending.dropFirst(chunk))
        }
    }
}
