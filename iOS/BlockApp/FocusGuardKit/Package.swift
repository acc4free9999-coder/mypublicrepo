// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FocusGuardKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "FocusGuardKit", targets: ["FocusGuardKit"])
    ],
    targets: [
        .target(name: "FocusGuardKit"),
        .testTarget(name: "FocusGuardKitTests", dependencies: ["FocusGuardKit"])
    ]
)
