import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

/// Native Apple Sign-In coordinator. Performs an `ASAuthorizationController`
/// request with `[.fullName, .email]` scopes (matches
/// `expo-apple-authentication`'s scope set in
/// `apps/mobile/src/features/auth/AuthService.ts:309-314`).
///
/// Supplies a fresh SHA256-hashed nonce per request — Supabase verifies the
/// nonce when ingesting the identity token in
/// `auth.signInWithIdToken(provider:.apple, idToken:nonce:)`.
final class AppleSignInCoordinator: NSObject {

    enum SignInError: Error {
        case canceled
        case failed(String)
        case missingCredential
    }

    /// The raw nonce used in the latest request. Supabase requires the raw
    /// nonce alongside the identity token in `signInWithIdToken`.
    private(set) static var currentNonce: String?

    // MARK: - Public entry point

    @MainActor
    static func requestCredential() async throws -> ASAuthorizationAppleIDCredential {
        let nonce = randomNonceString()
        Self.currentNonce = nonce

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let coordinator = AppleSignInCoordinator()
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = coordinator
        controller.presentationContextProvider = coordinator

        return try await withCheckedThrowingContinuation { continuation in
            coordinator.continuation = continuation
            // Retain coordinator until callback fires.
            coordinator.selfRetain = coordinator
            controller.performRequests()
        }
    }

    // MARK: - Internal state

    private var continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>?
    private var selfRetain: AppleSignInCoordinator?

    // MARK: - Nonce helpers

    private static func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")

        var result = ""
        var remaining = length
        while remaining > 0 {
            var randoms = [UInt8](repeating: 0, count: 16)
            let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
            if status != errSecSuccess {
                fatalError("Unable to generate nonce: status \(status)")
            }
            randoms.forEach { random in
                if remaining == 0 { return }
                if random < charset.count {
                    result.append(charset[Int(random)])
                    remaining -= 1
                }
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashed = SHA256.hash(data: inputData)
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AppleSignInCoordinator: ASAuthorizationControllerDelegate {
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        defer { selfRetain = nil }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            continuation?.resume(throwing: SignInError.missingCredential)
            continuation = nil
            return
        }
        continuation?.resume(returning: credential)
        continuation = nil
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        defer { selfRetain = nil }
        if let asError = error as? ASAuthorizationError, asError.code == .canceled {
            continuation?.resume(throwing: SignInError.canceled)
        } else {
            continuation?.resume(throwing: SignInError.failed(error.localizedDescription))
        }
        continuation = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleSignInCoordinator: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first {
            return window
        }
        return ASPresentationAnchor()
    }
}
