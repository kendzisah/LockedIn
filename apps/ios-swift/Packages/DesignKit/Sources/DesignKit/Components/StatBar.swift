import SwiftUI

/// Horizontal stat bar with a 600ms `easeOut` fill animation.
///
/// Track color: `rgba(255,255,255,0.06)`.
public struct StatBar: View {
    let progress: Double
    let color: Color
    let height: CGFloat

    @State private var displayedProgress: Double = 0

    public init(progress: Double, color: Color = SystemTokens.glowAccent, height: CGFloat = 6) {
        self.progress = max(0, min(1, progress))
        self.color = color
        self.height = height
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(SystemTokens.barTrack)
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(color)
                    .frame(width: max(0, proxy.size.width * displayedProgress))
                    .shadow(color: color.opacity(0.55), radius: 6, x: 0, y: 0)
            }
        }
        .frame(height: height)
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                displayedProgress = progress
            }
        }
        .onChange(of: progress) { _, newValue in
            withAnimation(.easeOut(duration: 0.6)) {
                displayedProgress = newValue
            }
        }
    }
}
