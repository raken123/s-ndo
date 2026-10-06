import UIKit
import WebKit

/// One AI for iPhone and iPad: the web app from the bundle's www/ folder in a
/// WKWebView, plus a bridge (window.OneNative) for saving and sharing files.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    private var web: WKWebView!

    // Promises in the page: OneBridge (js/bridge.js) accepts them.
    private static let bridgeScript = """
    window.OneNative = {
      saveFile: function (t, name, mime, data) { return window.webkit.messageHandlers.one.postMessage({ action: 'save', name: name, mime: mime, data: data }); },
      shareFile: function (t, name, mime, data, text) { return window.webkit.messageHandlers.one.postMessage({ action: 'share', name: name, mime: mime, data: data, text: text || '' }); },
      appVersion: function () { return '\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")'; },
      platform: function () { return 'ios'; }
    };
    """

    override func loadView() {
        let config = WKWebViewConfiguration()
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        content.addScriptMessageHandler(self, contentWorld: .page, name: "one")
        config.userContentController = content
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = .systemBackground
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let www = Bundle.main.url(forResource: "www", withExtension: nil) else { return }
        web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
    }

    // MARK: bridge

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        // Previews run in iframes; only the app page itself may save files.
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any],
              let name = body["name"] as? String, let b64 = body["data"] as? String,
              let data = Data(base64Encoded: b64) else {
            replyHandler("{\"ok\":false,\"error\":\"Not allowed\"}", nil)
            return
        }
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:")).joined(separator: "-")
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("One AI", isDirectory: true)
        let file = dir.appendingPathComponent(safe.isEmpty ? "fil" : safe)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
        } catch {
            replyHandler("{\"ok\":false,\"error\":\"\(error.localizedDescription.replacingOccurrences(of: "\"", with: "'"))\"}", nil)
            return
        }
        // iOS saves through the share sheet ("Spara i Filer", AirDrop, apps).
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
        sheet.completionWithItemsHandler = { _, completed, _, _ in
            replyHandler(completed ? "{\"ok\":true,\"path\":\"\(safe)\",\"message\":\"Klart\"}" : "{\"ok\":false,\"error\":\"cancelled\"}", nil)
        }
        present(sheet, animated: true)
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.isFileURL || url.scheme == "about" || url.scheme == "data" || url.scheme == "blob" {
            return decisionHandler(.allow)
        }
        // Web links open in Safari; the app never navigates away.
        if action.targetFrame?.isMainFrame ?? true, ["http", "https", "mailto"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["http", "https"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    // MARK: alert / confirm (WKWebView shows nothing without these)

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Avbryt", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }
}
