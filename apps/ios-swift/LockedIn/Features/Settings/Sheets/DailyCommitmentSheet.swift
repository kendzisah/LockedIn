import SwiftUI
import DesignKit

/// Single-select duration picker. Port of
/// `apps/mobile/src/features/settings/sheets/DailyCommitmentSheet.tsx`.
///
/// Options: `[15, 30, 45, 60, 90, 120]` minutes. Fires `Settings Changed`
/// (`setting=daily_commitment`) on save.
struct DailyCommitmentSheet: View {
    let current: Int
    let onSave: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selection: Int

    private let options: [Int] = [15, 30, 45, 60, 90, 120]

    init(current: Int, onSave: @escaping (Int) -> Void) {
        self.current = current
        self.onSave = onSave
        _selection = State(initialValue: current)
    }

    var body: some View {
        SettingsSheetShell(title: "Daily Commitment") {
            VStack(spacing: 6) {
                ForEach(options, id: \.self) { minutes in
                    let active = selection == minutes
                    Button(action: { selection = minutes; HapticsService.shared.selectionChanged() }) {
                        HStack {
                            Text("\(minutes) MINUTES")
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                                .tracking(1.2)
                                .foregroundColor(active ? SystemTokens.textPrimary : SystemTokens.textSecondary)
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                        .background(
                            HStack(spacing: 0) {
                                Rectangle()
                                    .fill(active ? SystemTokens.glowAccent : Color.white.opacity(0.06))
                                    .frame(width: 2)
                                (active
                                    ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12)
                                    : Color.white.opacity(0.02))
                            }
                        )
                    }
                    .buttonStyle(PressOpacityButtonStyle())
                }
            }
            .padding(.bottom, 18)

            Button(action: {
                onSave(selection)
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
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
    }
}
