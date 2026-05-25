import SwiftUI
import UIKit
import DesignKit

/// Streak-3 sign-up nudge bottom sheet.
///
/// Port of `apps/mobile/src/features/auth/components/SignUpNudgeSheet.tsx`.
///
/// Behaviour matches RN 1:1:
/// - First impression sets `@lockedin/signup_nudge_streak3_shown = "true"` and
///   fires `Signup Nudge Shown` ({ nudge_type: "streak_3" }).
/// - Dismissing fires `Signup Nudge Dismissed` and persists the flag.
/// - Tapping "Secure My Streak" fires `Signup Nudge Converted` and routes
///   to the SignUp screen (caller-supplied via `onConvert`).
public struct SignUpNudgeSheet: View {
    public static let nudgeKey = "@lockedin/signup_nudge_streak3_shown"

    let streak: Int
    let onDismiss: () -> Void
    /// Called when the user taps "Secure My Streak". Caller must route to the
    /// SignUp screen — this sheet does not own navigation.
    let onConvert: () -> Void

    public init(
        streak: Int,
        onDismiss: @escaping () -> Void,
        onConvert: @escaping () -> Void
    ) {
        self.streak = streak
        self.onDismiss = onDismiss
        self.onConvert = onConvert
    }

    public var body: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(alignment: .leading, spacing: 0) {
                Capsule()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 36, height: 4)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, 20)

                Text("🔥 \(streak)-day streak!")
                    .appText(Typography.heading)
                    .foregroundColor(AppColors.textPrimary)

                Text("You're building real momentum. Create a free account so you never lose it.")
                    .appText(Typography.bodyMedium)
                    .foregroundColor(AppColors.textSecondary)
                    .padding(.top, 8)

                Button(action: {
                    AuthAnalytics.log(AuthAnalytics.signupNudgeConverted, properties: ["nudge_type": "streak_3"])
                    Defaults.setString("true", Self.nudgeKey)
                    onConvert()
                }) {
                    Text("Secure My Streak")
                        .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                        .foregroundColor(AppColors.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(AppColors.primary.opacity(0.12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(AppColors.primary.opacity(0.25), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(PressOpacityButtonStyle())
                .padding(.top, 20)

                Button(action: {
                    AuthAnalytics.log(AuthAnalytics.signupNudgeDismissed, properties: ["nudge_type": "streak_3"])
                    Defaults.setString("true", Self.nudgeKey)
                    onDismiss()
                }) {
                    Text("Not now")
                        .appText(Typography.subtext)
                        .foregroundColor(AppColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 40)
            .background(AppColors.backgroundSecondary)
            .clipShape(
                RoundedCornerShape(corners: [.topLeft, .topRight], radius: 20)
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.6).ignoresSafeArea())
        .onAppear {
            AuthAnalytics.log(AuthAnalytics.signupNudgeShown, properties: ["nudge_type": "streak_3"])
        }
        .transition(.move(edge: .bottom))
    }
}

/// Helper shape that lets us round only specific corners (top corners of the
/// bottom sheet). SwiftUI's `RoundedRectangle` rounds all four uniformly.
private struct RoundedCornerShape: Shape {
    var corners: UIRectCorner
    var radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
