// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AppIntentsKit",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "AppIntentsKit",
            targets: ["AppIntentsKit"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "AppIntentsKit",
            path: "Sources/AppIntentsKit"
        )
    ]
)
