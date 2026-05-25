import SwiftUI

/// Streak tier system — color progression based on consecutive streak days.
///
/// Tiers: 3d → 7d → 1mo → 3mo → 6mo → 12mo → rotating
/// Each tier intensifies the bar and flame color.
///
/// Ported 1:1 from `apps/mobile/src/design/streakTiers.ts`.
public struct StreakTier: Equatable, Sendable {
    public let threshold: Int
    public let label: String
    public let color: Color
    public let colorLight: Color
    public let colorHex: String
    public let colorLightHex: String

    public init(threshold: Int, label: String, colorHex: String, colorLightHex: String) {
        self.threshold = threshold
        self.label = label
        self.colorHex = colorHex
        self.colorLightHex = colorLightHex
        self.color = Color(hex: colorHex)
        self.colorLight = Color(hex: colorLightHex)
    }
}

public enum StreakTiers {
    public static let all: [StreakTier] = [
        StreakTier(threshold: 3,   label: "3 Day",   colorHex: "#FF6B35", colorLightHex: "#FF8F5E"),
        StreakTier(threshold: 7,   label: "7 Day",   colorHex: "#FFD700", colorLightHex: "#FFE44D"),
        StreakTier(threshold: 30,  label: "1 Month", colorHex: "#00D68F", colorLightHex: "#33E5AA"),
        StreakTier(threshold: 90,  label: "3 Month", colorHex: "#00C2FF", colorLightHex: "#5AD8FF"),
        StreakTier(threshold: 180, label: "6 Month", colorHex: "#8B5CF6", colorLightHex: "#A78BFA"),
        StreakTier(threshold: 365, label: "1 Year",  colorHex: "#FF006E", colorLightHex: "#FF4D94"),
    ]

    public static let defaultColorHex = "#4B5563"
    public static let defaultColorLightHex = "#6B7280"
}

public struct StreakTierInfo: Equatable, Sendable {
    public let current: StreakTier?
    public let next: StreakTier?
    /// 0…1 progress within the current → next interval.
    public let progress: Double
    public let color: Color
    public let colorLight: Color
    public let colorHex: String
    public let colorLightHex: String
}

/// Compute the StreakTierInfo for a given streak length.
public func getStreakTierInfo(streak: Int) -> StreakTierInfo {
    let tiers = StreakTiers.all

    if streak < tiers[0].threshold {
        return StreakTierInfo(
            current: nil,
            next: tiers[0],
            progress: Double(streak) / Double(tiers[0].threshold),
            color: Color(hex: StreakTiers.defaultColorHex),
            colorLight: Color(hex: StreakTiers.defaultColorLightHex),
            colorHex: StreakTiers.defaultColorHex,
            colorLightHex: StreakTiers.defaultColorLightHex
        )
    }

    var currentIdx = 0
    for i in stride(from: tiers.count - 1, through: 0, by: -1) {
        if streak >= tiers[i].threshold {
            currentIdx = i
            break
        }
    }

    let current = tiers[currentIdx]
    let next: StreakTier? = currentIdx < tiers.count - 1 ? tiers[currentIdx + 1] : nil

    if let next {
        let span = Double(next.threshold - current.threshold)
        let progress = span > 0 ? Double(streak - current.threshold) / span : 1
        return StreakTierInfo(
            current: current,
            next: next,
            progress: min(1, progress),
            color: current.color,
            colorLight: current.colorLight,
            colorHex: current.colorHex,
            colorLightHex: current.colorLightHex
        )
    }

    // Past 365 days: rotate through all tier colors (~60 days each)
    let rotating = getRotatingTier(streak: streak)
    return StreakTierInfo(
        current: rotating,
        next: nil,
        progress: 1,
        color: rotating.color,
        colorLight: rotating.colorLight,
        colorHex: rotating.colorHex,
        colorLightHex: rotating.colorLightHex
    )
}

private func getRotatingTier(streak: Int) -> StreakTier {
    let tiers = StreakTiers.all
    let daysAfterYear = streak - 365
    let cycleDays = max(1, 365 / tiers.count) // ~60 days per color
    let tierIndex = ((daysAfterYear / cycleDays) % tiers.count + tiers.count) % tiers.count
    return tiers[tierIndex]
}

/// Build Lottie colorFilters for the fire animation using the tier color.
///
/// The returned dictionary maps Lottie keypath strings → SwiftUI `Color`. Use
/// `LottieView.getValueProvider(...)` to bind these in lottie-ios:
///   ```swift
///   for (keypath, color) in getFlameColorFilters(...) {
///     let uic = UIColor(color)
///     let provider = ColorValueProvider(uic.lottieColorValue)
///     animationView.setValueProvider(provider, keypath: AnimationKeypath(keypath: keypath))
///   }
///   ```
public func getFlameColorFilters(color: Color, colorLight: Color) -> [(keypath: String, color: Color)] {
    return [
        (keypath: "Ebene 1/VG_Flame_Def Konturen", color: color),
        (keypath: "Ebene 2/VG_Flame_Def Konturen", color: colorLight),
        (keypath: "Ebene 3/VG_Flame_Def Konturen", color: color),
        (keypath: "Ebene 4/VG_Flame_Def Konturen", color: colorLight),
        (keypath: "Ebene 5/VG_Flame_Def Konturen", color: color),
        (keypath: "Ebene 6/VG_Flame_Def Konturen", color: colorLight),
        (keypath: "Ebene 7/VG_Flame_Def Konturen", color: color),
        (keypath: "Ebene 8/VG_Flame_Def Konturen", color: colorLight),
        (keypath: "Ebene 9/VG_Flame_Def Konturen", color: color),
        (keypath: "Ebene 10/VG_Flame_Def Konturen", color: colorLight),
    ]
}
