import AVFoundation
import UIKit

/// The only screen: two square blue eyes on black.
///
/// While the phone charges (and is not locked out) the Gemini Live AI is awake,
/// watching through the camera and listening through the microphone.
/// A slow 180° turn dims the screen and closes the eyes; another one wakes it again.
final class MainViewController: UIViewController {
    private let eyes = EyesView()
    private lazy var flip = SlowFlipDetector { [weak self] in self?.onSlowFlip() }
    private var live: GeminiLive?
    private var camera: CameraFeeder?
    private var isActive = false
    private var sleeping = false
    private var savedBrightness = UIScreen.main.brightness
    private var recheckTimer: Timer?

    override func loadView() {
        view = eyes
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(updateAi), name: UIDevice.batteryStateDidChangeNotification, object: nil)
        center.addObserver(self, selector: #selector(updateAi), name: Prefs.lockoutChanged, object: nil)
        center.addObserver(self, selector: #selector(didBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(willResignActive), name: UIApplication.willResignActiveNotification, object: nil)
        // Wakes the AI again when a lockout runs out while the app is open.
        recheckTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.updateAi() }
        requestPermissions()
    }

    private func requestPermissions() {
        AVCaptureDevice.requestAccess(for: .video) { _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                DispatchQueue.main.async { self.updateAi() }
            }
        }
    }

    private var hasPermissions: Bool {
        AVCaptureDevice.authorizationStatus(for: .video) == .authorized
            && AVAudioSession.sharedInstance().recordPermission == .granted
    }

    @objc private func didBecomeActive() {
        isActive = true
        UIApplication.shared.isIdleTimerDisabled = true
        if sleeping { UIScreen.main.brightness = 0.02 }
        flip.start()
        updateAi()
    }

    @objc private func willResignActive() {
        isActive = false
        // iOS keeps an app's brightness after leaving it, so hand the user's brightness back.
        if sleeping { UIScreen.main.brightness = savedBrightness }
        flip.stop()
        updateAi()
    }

    /// Starts or stops the AI so that it runs exactly while it should.
    @objc private func updateAi() {
        let wanted = isActive && Charging.isCharging && !sleeping && !Prefs.isLockedOut && hasPermissions
        if wanted {
            if live == nil { startAi() }
        } else {
            stopAi()
        }
    }

    private func startAi() {
        let session = GeminiLive(apiKey: Prefs.apiKey, model: Prefs.model)
        session.onVoiceLevel = { [weak self] level in self?.eyes.voiceLevel = level }
        live = session
        session.start()
        let feeder = CameraFeeder { [weak session] jpeg in session?.sendVideo(jpeg) }
        camera = feeder
        feeder.start()
    }

    private func stopAi() {
        camera?.stop()
        camera = nil
        live?.stop()
        live = nil
        eyes.voiceLevel = 0
    }

    private func onSlowFlip() {
        sleeping.toggle()
        if sleeping {
            savedBrightness = UIScreen.main.brightness
            UIScreen.main.brightness = 0.02
        } else {
            UIScreen.main.brightness = savedBrightness
        }
        eyes.closed = sleeping
        updateAi()
    }

    func keySaved() {
        eyes.blinkTwice()
        stopAi()
        updateAi()
    }
}
