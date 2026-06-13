//
//  ScheduledSessionsScreen.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  Manage screen: list all scheduled sessions with enable toggle + delete; tap
//  a row to edit; "+" to add. Pushed onto the main stack from the Home panel.
//

import SwiftUI
import DesignKit

struct ScheduledSessionsScreen: View {
    @Bindable var store: ScheduledSessionsStore
    let onBack: () -> Void

    @State private var editing: ScheduledSession?
    @State private var showEditor = false

    var body: some View {
        ZStack(alignment: .top) {
            ScreenGradient().ignoresSafeArea()

            VStack(spacing: 0) {
                header

                ScrollView {
                    VStack(spacing: 10) {
                        if store.sessions.isEmpty {
                            emptyState
                        } else {
                            ForEach(store.sessions) { session in
                                row(session)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 120)
                }
                .scrollIndicators(.hidden)
            }
        }
        .sheet(isPresented: $showEditor) {
            ScheduledSessionEditorSheet(
                store: store,
                existing: editing
            )
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(SystemTokens.textPrimary)
            }
            Spacer()
            Text("SCHEDULED")
                .font(.custom(FontFamily.display.rawValue, size: 12))
                .tracking(2)
                .foregroundColor(SystemTokens.textPrimary)
            Spacer()
            Button(action: { editing = nil; showEditor = true }) {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(SystemTokens.glowAccent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 34, weight: .light))
                .foregroundColor(SystemTokens.textMuted)
            Text("No scheduled sessions yet")
                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                .foregroundColor(SystemTokens.textPrimary)
            Text("Set a start and end time to auto-block distracting apps — even when the app is closed.")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Button(action: { editing = nil; showEditor = true }) {
                Text("⟐  SCHEDULE A SESSION")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                    .tracking(1.6)
                    .foregroundColor(SystemTokens.glowAccent)
                    .padding(.vertical, 14)
                    .frame(maxWidth: .infinity)
                    .background(SystemTokens.glowAccent.opacity(0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(SystemTokens.glowAccent.opacity(0.35), lineWidth: 1)
                    )
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
        .padding(.top, 60)
    }

    // MARK: - Row

    private func row(_ session: ScheduledSession) -> some View {
        let accent = session.enabled ? SystemTokens.glowAccent : SystemTokens.textMuted
        return HUDOptionCard(
            isSelected: session.enabled,
            accentColor: accent,
            action: { editing = session; showEditor = true }
        ) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.displayLabel)
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 15))
                        .foregroundColor(session.enabled ? SystemTokens.textPrimary : SystemTokens.textMuted)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        Text(session.timeRangeString)
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textSecondary)
                        Text("·")
                            .foregroundColor(SystemTokens.textMuted)
                        Text(session.recurrenceSummary)
                            .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                            .foregroundColor(SystemTokens.cyan)
                    }
                }

                Spacer(minLength: 8)

                Text("\(session.durationMinutes)m")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textSecondary)

                Toggle("", isOn: Binding(
                    get: { session.enabled },
                    set: { store.setEnabled(id: session.id, $0) }
                ))
                .labelsHidden()
                .tint(SystemTokens.glowAccent)

                Button(action: { store.delete(id: session.id) }) {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(SystemTokens.red)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
