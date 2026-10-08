import AVFoundation
import CoreImage
import ImageIO
import QuartzCore

/// Sends roughly one JPEG per second from the front camera. Nothing is shown on screen.
final class CameraFeeder: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "se.chargamo.camera")
    private let ciContext = CIContext()
    private let onJpeg: (Data) -> Void
    private var lastSent: CFTimeInterval = 0
    private var configured = false

    init(onJpeg: @escaping (Data) -> Void) {
        self.onJpeg = onJpeg
        super.init()
    }

    func start() {
        queue.async { [self] in
            if !configured {
                configured = true
                configure()
            }
            if !session.inputs.isEmpty { session.startRunning() }
        }
    }

    func stop() {
        queue.async { [self] in
            if session.isRunning { session.stopRunning() }
        }
    }

    private func configure() {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        if session.canSetSessionPreset(.vga640x480) { session.sessionPreset = .vga640x480 }
        guard
            let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
                ?? AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: camera),
            session.canAddInput(input)
        else { return }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        if let connection = output.connection(with: .video) {
            if #available(iOS 17.0, *) {
                if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
            } else if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        let now = CACurrentMediaTime()
        guard now - lastSent >= 1, let pixels = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lastSent = now
        let image = CIImage(cvPixelBuffer: pixels)
        let options = [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.6]
        if let jpeg = ciContext.jpegRepresentation(of: image, colorSpace: CGColorSpaceCreateDeviceRGB(), options: options) {
            onJpeg(jpeg)
        }
    }
}
