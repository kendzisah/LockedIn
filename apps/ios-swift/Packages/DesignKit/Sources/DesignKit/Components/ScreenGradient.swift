import SwiftUI

/// Full-screen background gradient used by every top-level screen.
///
/// Gradient stops: `[#0E1116, #111922, #0E1116]` at `[0, 0.5, 1]`, top → bottom.
public struct ScreenGradient: View {
    public init() {}

    public var body: some View {
        LinearGradient(
            stops: [
                Gradient.Stop(color: Color(hex: "#0E1116"), location: 0.0),
                Gradient.Stop(color: Color(hex: "#111922"), location: 0.5),
                Gradient.Stop(color: Color(hex: "#0E1116"), location: 1.0)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }
}
