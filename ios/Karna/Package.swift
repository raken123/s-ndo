// swift-tools-version: 5.9
import PackageDescription

/// Reglerna som ett vanligt Swift-paket.
///
/// Poängen är att de går att testa **utan simulator**. Monni och det delade
/// lagret rör bara Foundation, så `swift test` kör dem direkt på macOS på
/// någon sekund. Att köra dem som ett iOS-testbundle krävde en simulator som
/// startade, och det var där bygget fastnade två gånger.
///
/// Xcode-appen läser samma filer via project.yml — en kopia av källan, två
/// byggsystem.
let package = Package(
    name: "SandoKarna",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "SandoKarna", targets: ["SandoKarna"])
    ],
    targets: [
        .target(name: "SandoKarna"),
        .testTarget(name: "SandoKarnaTests", dependencies: ["SandoKarna"])
    ]
)
