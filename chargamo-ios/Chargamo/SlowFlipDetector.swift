import CoreMotion

/// Fires when the phone is turned about 180° slowly, around any axis
/// (e.g. spun upside down on a magnetic charger). Quick flips are ignored.
final class SlowFlipDetector {
    private let motion = CMMotionManager()
    private let onSlowFlip: () -> Void

    private var ref: CMQuaternion?
    private var refTime = 0.0
    private var last: CMQuaternion?
    private var lastTime = 0.0
    private var speed = 0.0
    private var stillFor = 0.0
    private var cooldownUntil = 0.0

    private let triggerRad = 160.0 * Double.pi / 180.0
    private let fastRadPerSec = 2.6 // ~150°/s
    private let stillRadPerSec = 0.12
    private let stillReset = 0.8
    private let minDuration = 1.0
    private let maxDuration = 15.0
    private let cooldown = 1.5

    init(onSlowFlip: @escaping () -> Void) {
        self.onSlowFlip = onSlowFlip
    }

    func start() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        ref = nil
        last = nil
        speed = 0
        stillFor = 0
        motion.deviceMotionUpdateInterval = 1.0 / 50
        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let data else { return }
            self?.update(data.attitude.quaternion, at: data.timestamp)
        }
    }

    func stop() {
        motion.stopDeviceMotionUpdates()
    }

    private func update(_ q: CMQuaternion, at t: Double) {
        guard let reference = ref, let prev = last else {
            ref = q; refTime = t; last = q; lastTime = t
            return
        }
        let dt = t - lastTime
        guard dt > 0 else { return }
        let w = angle(prev, q) / dt
        speed += (w - speed) * min(1, dt * 8)
        last = q
        lastTime = t

        if speed > fastRadPerSec {
            // Too fast: not a slow turn. Start over from here.
            ref = q; refTime = t
            return
        }
        if speed < stillRadPerSec {
            stillFor += dt
            if stillFor > stillReset { ref = q; refTime = t; return }
        } else {
            stillFor = 0
        }

        let turned = angle(reference, q)
        let took = t - refTime
        if turned >= triggerRad && took >= minDuration && t >= cooldownUntil {
            cooldownUntil = t + cooldown
            ref = q; refTime = t
            onSlowFlip()
        } else if took > maxDuration {
            ref = q; refTime = t
        }
    }

    /// Rotation angle between two unit quaternions, 0...π.
    private func angle(_ a: CMQuaternion, _ b: CMQuaternion) -> Double {
        let dot = abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z)
        return 2 * acos(min(1, dot))
    }
}
