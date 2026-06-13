import SwiftUI
import AuthenticationServices
import DesignKit

/// Apple-required Sign in with Apple control (App Store review). Port of
/// `apps/mobile/src/features/auth/components/AppleAuthButton.tsx`.
///
/// Renders the native `ASAuthorizationAppleIDButton` (the only style Apple
/// permits in the App Store guidelines), bridged via UIViewRepresentable so
/// the press routes through our `AuthService.signInWithApple()` coordinator.
/// The coordinator owns the full credential request flow — going through
/// `SignInWithAppleButton`'s onCompletion would skip our anonymous-link path.
///
/// Matches the RN spec: WHITE style, 14-point corner radius, 48-point height.
public struct AppleSignInButton: View {
    public enum Kind {
        case signIn
        case signUp

        var nativeType: ASAuthorizationAppleIDButton.ButtonType {
            switch self {
            case .signIn: return .signIn
            case .signUp: return .signUp
            }
        }
    }

    private let kind: Kind
    private let isDisabled: Bool
    private let onPress: () -> Void

    public init(kind: Kind, isDisabled: Bool = false, onPress: @escaping () -> Void) {
        self.kind = kind
        self.isDisabled = isDisabled
        self.onPress = onPress
    }

    public var body: some View {
        NativeAppleButton(buttonType: kind.nativeType, action: onPress)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .allowsHitTesting(!isDisabled)
            .opacity(isDisabled ? 0.45 : 1.0)
    }
}

/// UIKit bridge that renders the canonical Apple-required button and routes
/// touches to a Swift closure. We use the `.white` style to match
/// `AppleAuthenticationButtonStyle.WHITE` in the RN component.
private struct NativeAppleButton: UIViewRepresentable {
    let buttonType: ASAuthorizationAppleIDButton.ButtonType
    let action: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(action: action) }

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: buttonType, style: .white)
        button.cornerRadius = 14
        button.addTarget(context.coordinator,
                         action: #selector(Coordinator.handleTap),
                         for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.action = action
    }

    final class Coordinator: NSObject {
        var action: () -> Void
        init(action: @escaping () -> Void) {
            self.action = action
        }
        @objc func handleTap() {
            action()
        }
    }
}
