import SwiftUI
import DesignKit

/// iOS-style 3-column wheel picker (hours / minutes / AM-PM). Port of
/// `apps/mobile/src/features/settings/sheets/ReminderTimeSheet.tsx`.
///
/// Persists via `SettingsState.setReminderTime(...)` which re-schedules the
/// daily reminder.
struct ReminderTimeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(SettingsState.self) private var state

    @State private var hour12: Int = 9
    @State private var minute: Int = 0
    @State private var isAM: Bool = true
    @State private var showSetAlert: Bool = false
    @State private var alertMessage: String = ""

    private let hours: [Int] = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    private let minutes: [Int] = [0, 15, 30, 45]

    var body: some View {
        SettingsSheetShell(title: "Daily reminder time") {
            Text("We'll remind you to lock in at this time")
                .appText(TypographyPreset(family: .body, size: 13))
                .foregroundColor(AppColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)

            HStack(spacing: 8) {
                Picker("Hour", selection: $hour12) {
                    ForEach(hours, id: \.self) { h in
                        Text(String(h)).foregroundColor(AppColors.textPrimary).tag(h)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxWidth: .infinity)

                Picker("Minute", selection: $minute) {
                    ForEach(minutes, id: \.self) { m in
                        Text(String(format: "%02d", m)).foregroundColor(AppColors.textPrimary).tag(m)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxWidth: .infinity)

                Picker("AM/PM", selection: $isAM) {
                    Text("AM").tag(true)
                    Text("PM").tag(false)
                }
                .pickerStyle(.wheel)
                .frame(width: 100)
            }
            .padding(.bottom, 4)

            Button(action: handleSet) {
                Text("Set Time")
                    .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                    .foregroundColor(AppColors.textPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppColors.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(PressOpacityButtonStyle())
            .padding(.top, 20)
        }
        .onAppear {
            // Seed from current state.
            let (h, am) = Self.from24h(state.reminderHour)
            hour12 = h
            isAM = am
            let m = minutes.contains(state.reminderMinute) ? state.reminderMinute : 0
            minute = m
        }
        .alert("Reminder set", isPresented: $showSetAlert) {
            Button("OK", role: .cancel) { dismiss() }
        } message: {
            Text(alertMessage)
        }
    }

    private func handleSet() {
        let hour24 = Self.to24h(h12: hour12, am: isAM)
        Task {
            await state.setReminderTime(hour: hour24, minute: minute)
            alertMessage = "Reminder set for \(state.reminderLabel)"
            showSetAlert = true
        }
    }

    private static func to24h(h12: Int, am: Bool) -> Int {
        if h12 == 12 { return am ? 0 : 12 }
        return am ? h12 : h12 + 12
    }

    private static func from24h(_ h: Int) -> (Int, Bool) {
        let am = h < 12
        if h == 0 { return (12, true) }
        if h == 12 { return (12, false) }
        return (h < 12 ? h : h - 12, am)
    }
}
