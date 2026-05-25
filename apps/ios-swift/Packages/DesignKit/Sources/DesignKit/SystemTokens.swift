import SwiftUI

/// SystemTokens — Centralized HUD design tokens for the home/session
/// surfaces. Every panel reads from here so the entire system shares one
/// visual language.
///
/// Ported 1:1 from `apps/mobile/src/features/home/systemTokens.ts`.
public enum SystemTokens {
    public static let panelBg          = Color(.sRGB, red: 10/255,  green: 22/255,  blue: 40/255,  opacity: 0.85)
    public static let panelBorder      = Color(.sRGB, red: 58/255,  green: 102/255, blue: 255/255, opacity: 0.12)
    public static let panelRadius: CGFloat = 4
    public static let bracketColor     = Color(.sRGB, red: 58/255,  green: 102/255, blue: 255/255, opacity: 0.6)
    public static let divider          = Color.white.opacity(0.06)
    public static let barTrack         = Color.white.opacity(0.06)
    public static let glowAccent       = Color(hex: "#3A66FF")
    public static let glowAccentSoft   = Color(.sRGB, red: 58/255,  green: 102/255, blue: 255/255, opacity: 0.06)
    public static let cyan             = Color(hex: "#00C2FF")
    public static let green            = Color(hex: "#00D68F")
    public static let gold             = Color(hex: "#FFC857")
    public static let purple           = Color(hex: "#A855F7")
    public static let red              = Color(hex: "#FF4757")
    public static let textPrimary      = Color(hex: "#FFFFFF")
    public static let textSecondary    = Color(hex: "#9CA3AF")
    public static let textMuted        = Color(hex: "#6B7280")
    public static let textGlow         = Color(.sRGB, red: 58/255,  green: 102/255, blue: 255/255, opacity: 0.4)
}

/// The five primary user stats. Mirrors `Stat` from `@lockedin/shared-types`.
public enum Stat: String, CaseIterable, Codable, Sendable {
    case discipline
    case focus
    case execution
    case consistency
    case social
}

public enum StatTokens {
    public static let colors: [Stat: Color] = [
        .discipline:  Color(hex: "#3A66FF"),
        .focus:       Color(hex: "#00C2FF"),
        .execution:   Color(hex: "#00D68F"),
        .consistency: Color(hex: "#FFC857"),
        .social:      Color(hex: "#A855F7"),
    ]

    public static let labels: [Stat: String] = [
        .discipline:  "DIS",
        .focus:       "FOC",
        .execution:   "EXE",
        .consistency: "CON",
        .social:      "SOC",
    ]
}

/// Section label style — small, blue, wide letter-spacing.
public struct SectionLabelStyle: ViewModifier {
    public init() {}
    public func body(content: Content) -> some View {
        content
            .font(.custom(FontFamily.headingBold.rawValue, size: 11))
            .tracking(2.5)
            .foregroundColor(SystemTokens.glowAccent)
    }
}

/// Section meta style — small, muted, mild letter-spacing.
public struct SectionMetaStyle: ViewModifier {
    public init() {}
    public func body(content: Content) -> some View {
        content
            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
            .tracking(1.0)
            .foregroundColor(SystemTokens.textMuted)
    }
}

public extension View {
    /// Apply the HUD section label style (small, blue, wide letter-spacing).
    func sectionLabel() -> some View { modifier(SectionLabelStyle()) }

    /// Apply the HUD section meta style (small, muted, mild letter-spacing).
    func sectionMeta() -> some View { modifier(SectionMetaStyle()) }
}

/// Tracks whether the HUD boot animation has played once this session. The RN
/// equivalent lived as a module-level `_hasBooted` flag — kept here for parity.
public enum BootState {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var _hasBooted = false

    public static func getHasBooted() -> Bool {
        lock.lock(); defer { lock.unlock() }
        return _hasBooted
    }

    public static func markBooted() {
        lock.lock(); defer { lock.unlock() }
        _hasBooted = true
    }
}
