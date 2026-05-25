import SwiftUI

/// Core color palette for the LockedIn app.
///
/// Palette: Deep graphite base, Discipline Blue accent, Electric Cyan edge.
/// Feels: Precise. Structured. Technical.
///
/// Ported 1:1 from `apps/mobile/src/design/colors.ts`.
public enum AppColors {
    // ─── Backgrounds ───
    /// Primary background — deep graphite
    public static let background = Color(hex: "#0E1116")
    /// Secondary background — adds depth without full black
    public static let backgroundSecondary = Color(hex: "#151A21")
    /// Elevated surface / cards / dividers — deep steel
    public static let surface = Color(hex: "#2C3440")

    // ─── Accent ───
    /// Primary accent — Discipline Blue (buttons, CTAs, active states)
    public static let primary = Color(hex: "#3A66FF")
    /// Subtle edge accent — Electric Cyan (streaks, Lock In active). Use sparingly.
    public static let accent = Color(hex: "#00C2FF")

    // ─── Text ───
    /// Primary text — high contrast on dark
    public static let textPrimary = Color(hex: "#FFFFFF")
    /// Secondary text
    public static let textSecondary = Color(hex: "#9CA3AF")
    /// Muted text
    public static let textMuted = Color(hex: "#6B7280")

    // ─── Utility ───
    /// Disabled / inactive elements
    public static let disabled = Color(hex: "#2C3440")
    /// Success / positive feedback
    public static let success = Color(hex: "#00D68F")
    /// Danger / destructive actions
    public static let danger = Color(hex: "#FF4757")
    /// Warning / upgrade prompts
    public static let warning = Color(hex: "#FFC857")

    // ─── Lock In Active Mode ───
    /// Near-black immersive background when session is running
    public static let lockInBackground = Color(hex: "#090C10")
}

// MARK: - Hex Initializer

public extension Color {
    /// Build a Color from a hex string. Supports `#RGB`, `#RRGGBB`, and `#RRGGBBAA`.
    /// Defaults to opaque black on invalid input.
    init(hex: String) {
        var trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("#") { trimmed.removeFirst() }

        var value: UInt64 = 0
        Scanner(string: trimmed).scanHexInt64(&value)

        let r, g, b, a: Double
        switch trimmed.count {
        case 3: // RGB (4-bit each)
            r = Double((value >> 8) & 0xF) / 15.0
            g = Double((value >> 4) & 0xF) / 15.0
            b = Double(value & 0xF) / 15.0
            a = 1.0
        case 6: // RRGGBB
            r = Double((value >> 16) & 0xFF) / 255.0
            g = Double((value >> 8) & 0xFF) / 255.0
            b = Double(value & 0xFF) / 255.0
            a = 1.0
        case 8: // RRGGBBAA
            r = Double((value >> 24) & 0xFF) / 255.0
            g = Double((value >> 16) & 0xFF) / 255.0
            b = Double((value >> 8) & 0xFF) / 255.0
            a = Double(value & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0; a = 1
        }

        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    /// Build a Color from RGBA literal components (0…255 / 0…1).
    static func rgba(_ r: Int, _ g: Int, _ b: Int, _ a: Double = 1.0) -> Color {
        Color(.sRGB, red: Double(r) / 255.0, green: Double(g) / 255.0, blue: Double(b) / 255.0, opacity: a)
    }
}
