import SwiftUI
import DesignKit

/// HUDStatBar — One labeled progress row used across the HUD: a 3-letter
/// label, an animated track-fill bar (`DesignKit.StatBar`), and a numeric
/// value on the right.
///
/// Ports `apps/mobile/src/features/home/components/StatBar.tsx`. Animation
/// duration (600ms / `easeOut`) is owned by `DesignKit.StatBar`.
struct HUDStatBar: View {
    let label: String
    let value: String
    let progress: Double
    let color: Color
    let delay: Double
    let labelWidth: CGFloat
    let valueWidth: CGFloat
    let valueAlignment: HorizontalAlignment
    let hideValue: Bool
    let height: CGFloat

    init(
        label: String,
        value: String,
        progress: Double,
        color: Color,
        delay: Double = 0,
        labelWidth: CGFloat = 32,
        valueWidth: CGFloat = 28,
        valueAlignment: HorizontalAlignment = .trailing,
        hideValue: Bool = false,
        height: CGFloat = 18
    ) {
        self.label = label
        self.value = value
        self.progress = progress
        self.color = color
        self.delay = delay
        self.labelWidth = labelWidth
        self.valueWidth = valueWidth
        self.valueAlignment = valueAlignment
        self.hideValue = hideValue
        self.height = height
    }

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.0)
                .foregroundColor(color)
                .frame(width: labelWidth, alignment: .leading)
                .lineLimit(1)

            StatBar(progress: progress, color: color, height: 5)
                .frame(maxWidth: .infinity)

            if !hideValue {
                Text(value)
                    .font(.custom(FontFamily.headingSemiBold.rawValue, size: 11))
                    .tracking(0.3)
                    .foregroundColor(SystemTokens.textPrimary)
                    .frame(width: valueWidth, alignment: hudFrameAlignment)
                    .lineLimit(1)
            }
        }
        .frame(height: height)
    }

    /// Maps the `HorizontalAlignment` enum (used inside VStacks / HStacks)
    /// to the `Alignment` value `.frame(width:alignment:)` expects.
    private var hudFrameAlignment: Alignment {
        switch valueAlignment {
        case .leading:  return .leading
        case .center:   return .center
        case .trailing: return .trailing
        default:        return .trailing
        }
    }

    /// Convenience initializer taking `current / max` (matches the RN
    /// `current` + `max` props).
    init(
        label: String,
        valueText: String,
        current: Double,
        max: Double,
        color: Color,
        delay: Double = 0,
        labelWidth: CGFloat = 32,
        valueWidth: CGFloat = 28,
        valueAlignment: HorizontalAlignment = .trailing,
        hideValue: Bool = false,
        height: CGFloat = 18
    ) {
        self.init(
            label: label,
            value: valueText,
            progress: max > 0 ? min(1, Swift.max(0, current / max)) : 0,
            color: color,
            delay: delay,
            labelWidth: labelWidth,
            valueWidth: valueWidth,
            valueAlignment: valueAlignment,
            hideValue: hideValue,
            height: height
        )
    }
}
