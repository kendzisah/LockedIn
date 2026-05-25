import SwiftUI
import DesignKit

/// Multi-select weakness picker (1-3 options). Port of
/// `apps/mobile/src/features/settings/sheets/WeaknessPickerSheet.tsx`.
///
/// The RN version fetches options from `getWeaknessOptions()` in
/// `MissionEngine`. This Swift port renders the canonical RN list verbatim
/// until W4 ships `MissionEngine`; the coordinator wires the dynamic list
/// later.
struct WeaknessPickerSheet: View {
    let current: [String]
    let onSave: ([String]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selection: Set<String>

    /// Canonical RN options (from `MissionEngine.getWeaknessOptions()`).
    /// W4 will replace this list with the live engine output during integration.
    private let options: [String] = [
        "Doomscrolling",
        "Procrastination",
        "Social media",
        "Late-night phone use",
        "Junk food / snacking",
        "Caffeine over-reliance",
        "Disorganization",
        "Sleep schedule",
    ]

    init(current: [String], onSave: @escaping ([String]) -> Void) {
        self.current = current
        self.onSave = onSave
        _selection = State(initialValue: Set(current))
    }

    var body: some View {
        SettingsSheetShell(title: "Focus Areas") {
            Text("SELECT 1–3 AREAS")
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)

            VStack(spacing: 6) {
                ForEach(options, id: \.self) { label in
                    let on = selection.contains(label)
                    let atMax = selection.count >= 3 && !on
                    Button(action: {
                        guard !atMax else { return }
                        toggle(label)
                        HapticsService.shared.selectionChanged()
                    }) {
                        HStack(spacing: 12) {
                            // Checkbox
                            ZStack {
                                Rectangle()
                                    .fill(on ? SystemTokens.glowAccent : Color.clear)
                                    .overlay(
                                        Rectangle()
                                            .stroke(on ? SystemTokens.glowAccent : Color.white.opacity(0.2), lineWidth: 1.5)
                                    )
                                    .frame(width: 18, height: 18)
                                if on {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(SystemTokens.textPrimary)
                                }
                            }

                            Text(label)
                                .font(.custom(on
                                    ? FontFamily.headingSemiBold.rawValue
                                    : FontFamily.bodyMedium.rawValue, size: 14))
                                .tracking(-0.1)
                                .foregroundColor(on ? SystemTokens.textPrimary : SystemTokens.textSecondary)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .background(
                            HStack(spacing: 0) {
                                Rectangle()
                                    .fill(on ? SystemTokens.glowAccent : Color.white.opacity(0.06))
                                    .frame(width: 2)
                                (on
                                    ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12)
                                    : Color.white.opacity(0.02))
                            }
                        )
                        .opacity(atMax ? 0.35 : 1)
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                    .disabled(atMax)
                }
            }
            .padding(.bottom, 18)

            let canSave = !selection.isEmpty
            Button(action: {
                guard canSave else { return }
                onSave(Array(selection))
                dismiss()
            }) {
                Text("⟐  UPDATE")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                    .tracking(1.8)
                    .foregroundColor(SystemTokens.glowAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18))
                    .overlay(
                        Rectangle()
                            .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
                    )
                    .opacity(canSave ? 1 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!canSave)
        }
    }

    private func toggle(_ label: String) {
        if selection.contains(label) {
            selection.remove(label)
        } else if selection.count < 3 {
            selection.insert(label)
        }
    }
}
