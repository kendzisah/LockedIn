import SwiftUI
import DesignKit
import Lottie

/// SwiftUI wrapper around the `lock_close.json` Lottie animation. Used by
/// the `ExecutionBlockScreen` hold-to-end button so the lock visually closes
/// as the user holds. Falls back to an SF Symbol when the JSON asset isn't
/// bundled, matching the `FlameLottieView` pattern.
public struct LockLottieView: View {
    /// Drives Lottie playhead position (0.0 → 1.0). When the caller binds
    /// this to the hold progress, the lock animates closed in lockstep with
    /// the hold gesture.
    private let progress: CGFloat

    public init(progress: CGFloat) {
        self.progress = max(0, min(1, progress))
    }

    public var body: some View {
        Group {
            if LockLottieView.animationAvailable {
                LottieView { LottieAnimation.named("lock_close") }
                    .currentProgress(progress)
            } else {
                LockSymbolFallback(progress: progress)
            }
        }
    }

    private static let animationAvailable: Bool = {
        Bundle.main.url(forResource: "lock_close", withExtension: "json") != nil
    }()
}

private struct LockSymbolFallback: View {
    let progress: CGFloat

    var body: some View {
        Image(systemName: progress >= 1.0 ? "lock.fill" : "lock.open.fill")
            .resizable()
            .scaledToFit()
            .foregroundColor(AppColors.textMuted)
            .opacity(0.5)
    }
}
