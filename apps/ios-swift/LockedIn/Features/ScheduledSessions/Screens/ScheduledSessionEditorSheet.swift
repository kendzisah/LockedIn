//
//  ScheduledSessionEditorSheet.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  Create / edit a scheduled lock-in. Start + end time, weekday recurrence
//  (none = one-off), label, enabled. Saving re-syncs the DeviceActivity
//  auto-block schedules + notifications via the store.
//

import SwiftUI
import DesignKit

struct ScheduledSessionEditorSheet: View {
    @Bindable var store: ScheduledSessionsStore
    let existing: ScheduledSession?

    @Environment(\.dismiss) private var dismiss

    @State private var label: String
    @State private var startDate: Date
    @State private var endDate: Date
    @State private var weekdays: Set<Int>
    @State private var enabled: Bool
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(store: ScheduledSessionsStore, existing: ScheduledSession?) {
        self.store = store
        self.existing = existing
        let cal = Calendar.current
        let today = Date()
        if let e = existing {
            _label = State(initialValue: e.label)
            _startDate = State(initialValue: cal.date(bySettingHour: e.startHour, minute: e.startMinute, second: 0, of: today) ?? today)
            _endDate = State(initialValue: cal.date(bySettingHour: e.endHour, minute: e.endMinute, second: 0, of: today) ?? today)
            _weekdays = State(initialValue: Set(e.weekdays))
            _enabled = State(initialValue: e.enabled)
        } else {
            _label = State(initialValue: "")
            _startDate = State(initialValue: cal.date(bySettingHour: 9, minute: 0, second: 0, of: today) ?? today)
            _endDate = State(initialValue: cal.date(bySettingHour: 10, minute: 0, second: 0, of: today) ?? today)
            _weekdays = State(initialValue: [])
            _enabled = State(initialValue: true)
        }
    }

    private var startHM: (Int, Int) { hourMinute(startDate) }
    private var endHM: (Int, Int) { hourMinute(endDate) }
    private var durationMinutes: Int {
        (endHM.0 * 60 + endHM.1) - (startHM.0 * 60 + startHM.1)
    }
    private var isValid: Bool { durationMinutes >= ScheduledSession.minWindowMinutes }
    /// Message for the duration row / save gating — distinguishes "end before
    /// start" from "shorter than the iOS DeviceActivity minimum".
    private var durationProblem: String? {
        if durationMinutes <= 0 { return "End time must be after start time" }
        if durationMinutes < ScheduledSession.minWindowMinutes {
            return "Must be at least \(ScheduledSession.minWindowMinutes) min — iOS won't monitor shorter windows"
        }
        return nil
    }

    var body: some View {
        ZStack(alignment: .top) {
            ScreenGradient().ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    title

                    field("LABEL") {
                        TextField("Lock In", text: $label)
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 15))
                            .foregroundColor(SystemTokens.textPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(Color.white.opacity(0.04))
                            .overlay(RoundedRectangle(cornerRadius: 4).stroke(SystemTokens.panelBorder, lineWidth: 1))
                    }

                    HStack(spacing: 12) {
                        field("START") {
                            DatePicker("", selection: $startDate, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                                .colorScheme(.dark)
                                .tint(SystemTokens.glowAccent)
                        }
                        field("END") {
                            DatePicker("", selection: $endDate, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                                .colorScheme(.dark)
                                .tint(SystemTokens.glowAccent)
                        }
                    }

                    durationRow

                    field("REPEAT") {
                        weekdayChips
                    }

                    Toggle(isOn: $enabled) {
                        Text("Enabled")
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                            .foregroundColor(SystemTokens.textPrimary)
                    }
                    .tint(SystemTokens.glowAccent)

                    if let errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 12))
                            Text(errorMessage)
                                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                        }
                        .foregroundColor(SystemTokens.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    saveButton

                    if existing != nil {
                        Button(action: deleteAndDismiss) {
                            Text("Delete")
                                .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                                .foregroundColor(SystemTokens.red)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
            .scrollIndicators(.hidden)
            .onChange(of: startDate) { _, _ in errorMessage = nil }
            .onChange(of: endDate) { _, _ in errorMessage = nil }
            .onChange(of: weekdays) { _, _ in errorMessage = nil }
            .onChange(of: enabled) { _, _ in errorMessage = nil }
        }
    }

    // MARK: - Pieces

    private var title: some View {
        HStack {
            Text(existing == nil ? "// NEW SESSION" : "// EDIT SESSION")
                .font(.custom(FontFamily.display.rawValue, size: 11))
                .tracking(1.8)
                .foregroundColor(SystemTokens.glowAccent)
            Spacer()
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(SystemTokens.textMuted)
            }
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.custom(FontFamily.display.rawValue, size: 9))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var durationRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "timer")
                .font(.system(size: 12))
                .foregroundColor(isValid ? SystemTokens.cyan : SystemTokens.red)
            Text(durationProblem ?? "\(durationMinutes) min lock-in")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                .foregroundColor(isValid ? SystemTokens.textSecondary : SystemTokens.red)
        }
    }

    private var weekdayChips: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                ForEach(ScheduledSession.weekdayChipOrder, id: \.self) { wd in
                    let on = weekdays.contains(wd)
                    Button(action: { toggleWeekday(wd) }) {
                        Text(ScheduledSession.weekdayInitial[wd])
                            .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                            .foregroundColor(on ? SystemTokens.glowAccent : SystemTokens.textMuted)
                            .frame(width: 36, height: 36)
                            .background((on ? SystemTokens.glowAccent : Color.white).opacity(on ? 0.14 : 0.03))
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(on ? SystemTokens.glowAccent.opacity(0.5) : SystemTokens.panelBorder, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            Text(weekdays.isEmpty ? "One-off — fires once on the next occurrence" : "Repeats weekly")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(SystemTokens.textMuted)
        }
    }

    private var saveButton: some View {
        Button(action: save) {
            Text("⟐  SAVE")
                .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                .tracking(1.8)
                .foregroundColor(SystemTokens.glowAccent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(SystemTokens.glowAccent.opacity(isValid ? 0.18 : 0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(SystemTokens.glowAccent.opacity(isValid ? 0.45 : 0.2), lineWidth: 1)
                )
        }
        .disabled(!isValid || isSaving)
        .opacity(isValid ? 1 : 0.5)
    }

    // MARK: - Actions

    private func toggleWeekday(_ wd: Int) {
        if weekdays.contains(wd) { weekdays.remove(wd) } else { weekdays.insert(wd) }
    }

    private func save() {
        guard isValid, !isSaving else { return }   // !isSaving guards against a double-tap double-add
        let session = ScheduledSession(
            id: existing?.id ?? UUID().uuidString,
            label: label.trimmingCharacters(in: .whitespacesAndNewlines),
            startHour: startHM.0,
            startMinute: startHM.1,
            endHour: endHM.0,
            endMinute: endHM.1,
            weekdays: weekdays.sorted(),
            enabled: enabled,
            createdAt: existing?.createdAt ?? Date().timeIntervalSince1970 * 1000
        )

        // Reject overlapping windows — two active windows can fight over the
        // shield (one's end un-blocks apps mid-other-session). Only enabled
        // sessions register/fire, so only they can conflict.
        if session.enabled,
           let conflict = store.sessions.first(where: {
               $0.id != session.id && $0.enabled && session.overlaps(with: $0)
           }) {
            errorMessage = "Overlaps with “\(conflict.displayLabel)” · \(conflict.timeRangeString). Adjust the time or days."
            return
        }

        // Request Family Controls authorization BEFORE persisting. `add/update`
        // synchronously triggers `resyncAll`, which only registers DeviceActivity
        // monitoring when auth is already approved — so on a first-ever session
        // we must resolve auth first, else the schedule registers nothing until a
        // later resync.
        isSaving = true
        Task { @MainActor in
            let state = await ScreenTimeModule.shared.requestAuthorization()
            if existing == nil {
                store.add(session)
            } else {
                store.update(session)
            }
            // If access wasn't granted the session is saved but won't auto-block —
            // keep the sheet open and say so rather than silently "succeeding".
            if state != .approved {
                errorMessage = "Saved, but Screen Time access is off — this won't block apps until you enable it in Settings."
                isSaving = false
                return
            }
            dismiss()
        }
    }

    private func deleteAndDismiss() {
        if let e = existing { store.delete(id: e.id) }
        dismiss()
    }

    private func hourMinute(_ date: Date) -> (Int, Int) {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0, c.minute ?? 0)
    }
}
