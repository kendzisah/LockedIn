import SwiftUI

/// Font family constants. These names match the PostScript names of the bundled
/// `.ttf` files (see `apps/ios-swift/LockedIn/Resources/Fonts/README.md`).
///
/// Ported 1:1 from `apps/mobile/src/design/typography.ts`.
public enum FontFamily: String, Sendable {
    /// Inter Tight 800 — major statements, hero text
    case headingBold = "InterTight-ExtraBold"
    /// Inter Tight 700 — primary headings
    case heading = "InterTight-Bold"
    /// Inter Tight 600 — section headers
    case headingSemiBold = "InterTight-SemiBold"
    /// Inter 500 — emphasized body
    case bodyMedium = "Inter-Medium"
    /// Inter 400 — default body text
    case body = "Inter-Regular"
    /// JetBrains Mono 400 — terminal / system text (e.g. "> SYSTEM INITIALIZING")
    case mono = "JetBrainsMono-Regular"
    /// JetBrains Mono 700 — emphasized terminal text
    case monoBold = "JetBrainsMono-Bold"
    /// Michroma 400 — wide geometric display face. HUD eyebrows, section
    /// labels, and any "system / sci-fi" callout where you want the type to
    /// read as chrome rather than copy. Use sparingly — short strings only,
    /// usually with generous tracking and uppercase.
    case display = "Michroma-Regular"
}

/// A typography preset: family, size, tracking (letter-spacing), and line
/// spacing. SwiftUI applies tracking and line spacing via view modifiers, so
/// callers should use `.font(_:)` to get the `Font` and the convenience
/// `.appText(_:)` view modifier to apply tracking + line spacing together.
public struct TypographyPreset: Equatable, Sendable {
    public let family: FontFamily
    public let size: CGFloat
    public let tracking: CGFloat
    public let lineHeight: CGFloat?

    public init(family: FontFamily, size: CGFloat, tracking: CGFloat = 0, lineHeight: CGFloat? = nil) {
        self.family = family
        self.size = size
        self.tracking = tracking
        self.lineHeight = lineHeight
    }

    /// SwiftUI `Font` for this preset.
    public var font: Font {
        .custom(family.rawValue, size: size)
    }

    /// Line spacing in points (lineHeight − fontSize). 0 when no lineHeight set.
    public var lineSpacing: CGFloat {
        guard let lineHeight else { return 0 }
        return max(0, lineHeight - size)
    }
}

/// Typography presets for the LockedIn app.
///
/// Headline: Inter Tight — modern, slightly compressed, intentional.
/// Body: Inter — extremely readable, neutral, serious.
public enum Typography {
    /// Hero / major statement — Inter Tight 800
    public static let hero = TypographyPreset(family: .headingBold, size: 36, tracking: -0.5, lineHeight: 42)
    /// Primary heading — Inter Tight 700
    public static let heading = TypographyPreset(family: .heading, size: 28, tracking: -0.3, lineHeight: 34)
    /// Section header — Inter Tight 600
    public static let sectionHeader = TypographyPreset(family: .headingSemiBold, size: 22, tracking: -0.2, lineHeight: 28)
    /// Body text — Inter 400
    public static let body = TypographyPreset(family: .body, size: 16, lineHeight: 24)
    /// Emphasized body — Inter 500
    public static let bodyMedium = TypographyPreset(family: .bodyMedium, size: 16, lineHeight: 24)
    /// Subtext — Inter 400 smaller
    public static let subtext = TypographyPreset(family: .body, size: 14, lineHeight: 20)
    /// Caption — Inter 400 smallest
    public static let caption = TypographyPreset(family: .body, size: 12, lineHeight: 16)
    /// Button label — Inter Tight 600
    public static let button = TypographyPreset(family: .headingSemiBold, size: 17, tracking: -0.1)
    /// HUD eyebrow / chrome label — Michroma, wide tracking, uppercase by
    /// convention. Use for short labels like "PROOF", "SYSTEM",
    /// "PRIMARY OBJECTIVE". Pair with `AppColors.accent` or `textMuted`.
    public static let hudLabel = TypographyPreset(family: .display, size: 10, tracking: 2.4)
}

// MARK: - View modifier

public extension View {
    /// Apply font, tracking, and line spacing from a `TypographyPreset` in one call.
    func appText(_ preset: TypographyPreset) -> some View {
        self.font(preset.font)
            .tracking(preset.tracking)
            .lineSpacing(preset.lineSpacing)
    }
}
