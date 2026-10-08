import UIKit

/// Two square blue eyes on black. Nothing else.
final class EyesView: UIView {
    /// Eyes closed (sleep after a slow 180° turn).
    var closed = false

    /// Loudness of the AI voice, 0...1. Makes the eyes pulse while it speaks.
    var voiceLevel: Float = 0

    private let blue = UIColor(red: 30 / 255, green: 123 / 255, blue: 1, alpha: 1)
    private let blinkDuration: CFTimeInterval = 0.18
    private var lid: CGFloat = 1 // 1 open, 0 closed
    private var shownVoice: CGFloat = 0
    private var lastFrame: CFTimeInterval = 0
    private var nextBlink = CACurrentMediaTime() + 2.5
    private var extraBlinks: [CFTimeInterval] = []
    private var displayLink: CADisplayLink?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        isOpaque = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        displayLink?.invalidate()
        displayLink = nil
        if window != nil {
            let link = CADisplayLink(target: self, selector: #selector(tick))
            link.add(to: .main, forMode: .common)
            displayLink = link
        }
    }

    @objc private func tick() {
        setNeedsDisplay()
    }

    func blinkTwice() {
        let now = CACurrentMediaTime()
        extraBlinks += [now + 0.2, now + 0.55]
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        let now = CACurrentMediaTime()
        let dt = lastFrame == 0 ? 0 : CGFloat(min(now - lastFrame, 0.1))
        lastFrame = now

        ctx.setFillColor(UIColor.black.cgColor)
        ctx.fill(bounds)

        // Slow lids for falling asleep / waking up.
        let target: CGFloat = closed ? 0 : 1
        let lidSpeed: CGFloat = closed ? 0.9 : 2.5
        lid = lid < target ? min(target, lid + lidSpeed * dt) : max(target, lid - lidSpeed * dt)

        // Quick blinks while awake.
        var blink: CGFloat = 1
        if !closed {
            if now > nextBlink + blinkDuration { nextBlink = now + Double.random(in: 2.5...7) }
            extraBlinks.removeAll { now > $0 + blinkDuration }
            let start = extraBlinks.first.flatMap { now >= $0 ? $0 : nil } ?? nextBlink
            let p = CGFloat((now - start) / blinkDuration)
            if p >= 0 && p <= 1 { blink = abs(1 - 2 * p) }
        }

        shownVoice += (CGFloat(voiceLevel) - shownVoice) * min(1, dt * 14)

        let m = min(bounds.width, bounds.height)
        let size = m * 0.24 * (1 + 0.12 * shownVoice)
        let gap = m * 0.13
        let eyeHeight = max(size * lid * blink, size * 0.05)
        let cx = bounds.midX
        let cy = bounds.midY

        ctx.setFillColor(blue.withAlphaComponent(0.35 + 0.65 * lid).cgColor)
        ctx.fill(CGRect(x: cx - gap / 2 - size, y: cy - eyeHeight / 2, width: size, height: eyeHeight))
        ctx.fill(CGRect(x: cx + gap / 2, y: cy - eyeHeight / 2, width: size, height: eyeHeight))
    }
}
