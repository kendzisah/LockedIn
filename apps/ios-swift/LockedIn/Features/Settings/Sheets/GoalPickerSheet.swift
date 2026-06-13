import SwiftUI
import DesignKit

/// Single-select primary-goal picker. Port of
/// `apps/mobile/src/features/settings/sheets/GoalPickerSheet.tsx`.
///
/// The RN version filters this list against `getPrimaryGoals()` from
/// `MissionEngine` to keep stale options from leaking through. Until W4
/// ships `MissionEngine`, this Swift port renders the canonical RN list
/// verbatim. Coordinator wires the validator later.
struct GoalPickerSheet: View {
    let current: String
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selection: String
    @State private var showUpdatedAlert: Bool = false

    /// Canonical order from RN `GoalPickerSheet.tsx`.
    private let goals: [String] = [
        "Build a business or side project",
        "Advance my career",
        "Improve my physique",
        "Increase discipline & self-control",
        "Reduce distractions",
        "Improve emotional control",
        "Study with consistency",
    ]

    init(current: String, onSave: @escaping (String) -> Void) {
        self.current = current
        self.onSave = onSave
        _selection = State(initialValue: current)
    }

    var body: some View {
        SettingsSheetShell(title: "Primary Goal") {
            VStack(spacing: 6) {
                ForEach(goals, id: \.self) { goal in
                    let active = selection == goal
                    Button(action: { selection = goal; HapticsService.shared.selectionChanged() }) {
                        HStack {
                            Text(goal)
                                .font(.custom(active
                                    ? FontFamily.headingSemiBold.rawValue
                                    : FontFamily.bodyMedium.rawValue, size: 15))
                                .tracking(-0.1)
                                .foregroundColor(active ? SystemTokens.textPrimary : SystemTokens.textSecondary)
                                .multilineTextAlignment(.leading)
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
                showUpdatedAlert = true
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
        .alert("Missions updated", isPresented: $showUpdatedAlert) {
            Button("OK", role: .cancel) { dismiss() }
        } message: {
            Text("Missions updated for your new goal.")
        }
    }
}
