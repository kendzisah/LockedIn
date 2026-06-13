// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "DesignKit",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "DesignKit",
            targets: ["DesignKit"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "DesignKit",
            path: "Sources/DesignKit"
        )
    ]
)
