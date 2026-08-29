import SwiftUI

@main
struct SandoElevApp: App {
    @StateObject private var krediter = Krediter.delad

    var body: some Scene {
        WindowGroup {
            RotVy()
                .environmentObject(krediter)
        }
    }
}
