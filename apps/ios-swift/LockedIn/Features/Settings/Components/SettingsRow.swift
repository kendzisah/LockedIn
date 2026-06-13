import SwiftUI
import DesignKit

/// Single row primitive used inside `SettingsSection`.
///
/// Port of `apps/mobile/src/features/settings/components/SettingsRow.tsx`.
/// Supports three layouts based on init:
/// - **Tap row**: icon + label + (optional value) + chevron, fires `onPress`.
/// - **Toggle row**: icon + label + status text + `Toggle`. No press behaviour.
/// - **Static row**: icon + label + value (no chevron, no action). Pass
///   `showChevron: false` and no `onPress`.
///
/// Disabled rows render at reduced opacity and don't dispatch interactions.
struct SettingsRow: View {
    let icon: String
    let iconColor: Color
    let label: String
    let value: String?
    let valueColor: Color
    let onPress: (() -> Void)?
    let toggleBinding: Binding<Bool>?
    let toggleStatus: String?
    let toggleStatusColor: Color?
    let disabled: Bool
    let showChevron: Bool

    /// Tap / static row.
    init(
        icon: String,
        iconColor: Color = AppColors.textSecondary,
        label: String,
        value: String? = nil,
        valueColor: Color = AppColors.textSecondary,
        disabled: Bool = false,
        showChevron: Bool = true,
        onPress: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.label = label
        self.value = value
        self.valueColor = valueColor
        self.onPress = onPress
        self.toggleBinding = nil
        self.toggleStatus = nil
        self.toggleStatusColor = nil
        self.disabled = disabled
        self.showChevron = showChevron && onPress != nil
    }

    /// Toggle row.
    init(
        icon: String,
        iconColor: Color = AppColors.textSecondary,
        label: String,
        toggle: Binding<Bool>,
        toggleStatus: String? = nil,
        toggleStatusColor: Color? = nil,
        disabled: Bool = false
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.label = label
        self.value = nil
        self.valueColor = AppColors.textSecondary
        self.onPress = nil
        self.toggleBinding = toggle
        self.toggleStatus = toggleStatus
        self.toggleStatusColor = toggleStatusColor
        self.disabled = disabled
        self.showChevron = false
    }

    var body: some View {
        let core = HStack(spacing: 0) {
            // Icon column
            HStack { Image(systemName: icon)
                .font(.system(size: 18, weight: .regular))
                .foregroundColor(iconColor) }
                .frame(width: 36, alignment: .leading)

            // Label
            Text(label)
                .appText(TypographyPreset(family: .bodyMedium, size: 15))
                .foregroundColor(disabled ? AppColors.textMuted : AppColors.textPrimary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.trailing, 8)

            // Right side: toggle OR value+chevron
            if let toggleBinding {
                HStack(spacing: 10) {
                    if let toggleStatus, !toggleStatus.isEmpty {
                        Text(toggleStatus)
                            .appText(TypographyPreset(family: .bodyMedium, size: 13))
                            .foregroundColor(toggleStatusColor ?? AppColors.textMuted)
                    }
                    Toggle("", isOn: toggleBinding)
                        .labelsHidden()
                        .tint(AppColors.primary)
                        .disabled(disabled)
                }
            } else {
                HStack(spacing: 4) {
                    if let value, !value.isEmpty {
                        Text(value)
                            .appText(TypographyPreset(family: .body, size: 14))
                            .foregroundColor(valueColor)
                            .lineLimit(1)
                    }
                    if showChevron {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppColors.textMuted)
                    }
                }
            }
        }
        .frame(minHeight: 52)
        .padding(.horizontal, 16)
        .opacity(disabled ? 0.4 : 1)
        .contentShape(Rectangle())

        if let onPress, !disabled, toggleBinding == nil {
            Button(action: {
                HapticsService.shared.light()
                onPress()
            }) { core }
            .buttonStyle(SettingsRowPressStyle())
        } else {
            core
        }
    }
}

/// Press style for tap rows: subtle white overlay while pressed (matches
/// RN `pressed` style `rgba(255,255,255,0.04)`).
private struct SettingsRowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Color.white.opacity(0.04) : Color.clear)
    }
}
