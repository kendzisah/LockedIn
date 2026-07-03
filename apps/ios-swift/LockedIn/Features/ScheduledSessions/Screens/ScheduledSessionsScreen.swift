//
//  ScheduledSessionsScreen.swift
//  LockedIn — Scheduled Lock-In Sessions
//
//  Manage screen: list all scheduled sessions with enable toggle + delete; tap
//  a row to edit; "+" to add. Pushed onto the main stack from the Home panel.
//

import SwiftUI
import DesignKit
import FamilyControls

struct ScheduledSessionsScreen: View {
    @Bindable var store: ScheduledSessionsStore
    let onBack: () -> Void

    /// Drives the editor sheet by *item* rather than a bool. A bool-driven
    /// `.sheet(isPresented:)` evaluated its content before the separate
    /// `editing` state propagated, so tapping a row opened the editor with
    /// `existing == nil` — i.e. a "create" dialog instead of an edit. An
    /// item-driven sheet captures the target atomically. `session == nil` ⇒ create.
    private struct EditorTarget: Identifiable {
        let id: String
        let session: ScheduledSession?
    }
    @State private var editorTarget: EditorTarget?

    /// Live readout of the auto-block plumbing. Background app-blocking depends
    /// on the DeviceActivity extension being woken by iOS — which can't be
    /// observed in the simulator or from logs on a release build. This surfaces
    /// the four signals that tell us which link is broken when a scheduled
    /// window fails to block:
    ///   • Permission   — Family Controls authorized?
    ///   • Blocked apps — did the user actually pick apps? (0 ⇒ shield no-ops)
    ///   • Registered   — did `startMonitoring` register the OS schedule? (0 ⇒ registration failed)
    ///   • Extension last ran — did `intervalDidStart`/`End` ever fire? (never ⇒ OS isn't waking it)
    @State private var diag = ScheduledLockDiagnostics.empty
    @State private var showDiagnostics = false

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

                        diagnosticsCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 120)
                }
                .scrollIndicators(.hidden)
            }
        }
        .sheet(item: $editorTarget, onDismiss: { diag = ScheduledLockDiagnostics.capture() }) { target in
            ScheduledSessionEditorSheet(
                store: store,
                existing: target.session
            )
        }
        .onAppear { diag = ScheduledLockDiagnostics.capture() }
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
            Button(action: { editorTarget = EditorTarget(id: "new", session: nil) }) {
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
            Button(action: { editorTarget = EditorTarget(id: "new", session: nil) }) {
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
            action: { editorTarget = EditorTarget(id: session.id, session: session) }
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

    // MARK: - Diagnostics (auto-block health)

    private var diagnosticsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { withAnimation { showDiagnostics.toggle() } }) {
                HStack(spacing: 8) {
                    Image(systemName: "stethoscope")
                        .font(.system(size: 12, weight: .semibold))
                    Text("AUTO-BLOCK DIAGNOSTICS")
                        .font(.custom(FontFamily.display.rawValue, size: 10))
                        .tracking(1.6)
                    Spacer()
                    Image(systemName: showDiagnostics ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundColor(SystemTokens.textMuted)
            }
            .buttonStyle(.plain)

            if showDiagnostics {
                VStack(alignment: .leading, spacing: 8) {
                    diagRow("Permission", diag.auth, ok: diag.auth == "approved")
                    diagRow("Blocked apps", "\(diag.selectedApps)", ok: diag.selectedApps > 0)
                    diagRow("Extension sees apps", "\(diag.extensionSeesApps)", ok: diag.extensionSeesApps > 0)
                    diagRow("Registered windows", "\(diag.registeredActivities)", ok: diag.registeredActivities > 0)
                    diagRow("Last registration", diag.registrationStatus, ok: !diag.registrationStatus.contains("failed"))
                    diagRow("Extension last started", diag.lastStart, ok: diag.lastStart != "never")
                    diagRow("Extension last ended", diag.lastEnd, ok: diag.lastEnd != "never")

                    if !diag.events.isEmpty {
                        Text("RECENT EXTENSION EVENTS")
                            .font(.custom(FontFamily.display.rawValue, size: 9))
                            .tracking(1.4)
                            .foregroundColor(SystemTokens.textMuted)
                            .padding(.top, 4)
                        ForEach(Array(diag.events.prefix(8).enumerated()), id: \.offset) { _, e in
                            Text(e)
                                .font(.custom(FontFamily.body.rawValue, size: 11))
                                .foregroundColor(SystemTokens.textSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }

                    Button(action: {
                        store.resyncMonitoring()
                        diag = ScheduledLockDiagnostics.capture()
                    }) {
                        Text("⟳  RE-REGISTER + REFRESH")
                            .font(.custom(FontFamily.display.rawValue, size: 10))
                            .tracking(1.4)
                            .foregroundColor(SystemTokens.glowAccent)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity)
                            .background(SystemTokens.glowAccent.opacity(0.10))
                            .overlay(RoundedRectangle(cornerRadius: 4)
                                .stroke(SystemTokens.glowAccent.opacity(0.3), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 2)
                }
                .padding(.top, 12)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.03))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(Color.white.opacity(0.06), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.top, 16)
    }

    private func diagRow(_ label: String, _ value: String, ok: Bool) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(ok ? SystemTokens.green : SystemTokens.red)
                .frame(width: 7, height: 7)
            Text(label)
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
            Spacer()
            Text(value)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                .foregroundColor(SystemTokens.textPrimary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }
}

/// Snapshot of the scheduled auto-block plumbing, read from the shared App Group
/// suite + `ScreenTimeModule`. Pure reads — safe to call on the main actor.
private struct ScheduledLockDiagnostics {
    let auth: String
    let selectedApps: Int
    /// App count decoded from the App-Group selection the *extension* reads —
    /// distinct from `selectedApps` (the app's in-memory count). A mismatch
    /// means the shield would be empty in the background.
    let extensionSeesApps: Int
    let registeredActivities: Int
    /// Last resync outcome — e.g. "2 ok" or "1 ok · 1 failed: <reason>".
    let registrationStatus: String
    let lastStart: String
    let lastEnd: String
    /// Recent extension callbacks, newest first — e.g. "11:14 start · shield · …".
    let events: [String]

    /// Cheap placeholder so the View's `init` doesn't do App-Group + Family
    /// Controls reads on every SwiftUI rebuild — real data is captured in
    /// `.onAppear` / on editor dismissal / via the refresh button.
    static let empty = ScheduledLockDiagnostics(
        auth: "—", selectedApps: 0, extensionSeesApps: 0, registeredActivities: 0,
        registrationStatus: "—", lastStart: "never", lastEnd: "never", events: []
    )

    static func capture() -> ScheduledLockDiagnostics {
        let d = SharedScreenTime.sharedDefaults()
        let mapCount: Int = {
            guard let data = d?.data(forKey: SharedScreenTime.Keys.scheduledActivityMap),
                  let map = try? JSONDecoder().decode([String: ScheduledActivityMeta].self, from: data)
            else { return 0 }
            return map.count
        }()
        // Decode the App-Group selection exactly as the extension does.
        let extSees: Int = {
            guard let data = d?.data(forKey: SharedScreenTime.Keys.selection),
                  let sel = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
            else { return 0 }
            return sel.applicationTokens.count + sel.categoryTokens.count + sel.webDomainTokens.count
        }()
        let events: [String] = {
            guard let data = d?.data(forKey: SharedScreenTime.Keys.damEventLog),
                  let raw = try? JSONDecoder().decode([String].self, from: data)
            else { return [] }
            return raw.reversed().map(Self.formatEvent)
        }()
        return ScheduledLockDiagnostics(
            auth: ScreenTimeModule.shared.getAuthorizationStatus().rawValue,
            selectedApps: ScreenTimeModule.shared.getSelectedAppCount(),
            extensionSeesApps: extSees,
            registeredActivities: mapCount,
            registrationStatus: d?.string(forKey: SharedScreenTime.Keys.scheduledRegistrationStatus) ?? "—",
            lastStart: Self.format(d?.string(forKey: SharedScreenTime.Keys.damLastStart)),
            lastEnd: Self.format(d?.string(forKey: SharedScreenTime.Keys.damLastEnd)),
            events: events
        )
    }

    /// `"<ms>|<phase>|<outcome>|<activity>"` → `"HH:mm <phase> · <outcome> · <activity>"`.
    private static func formatEvent(_ raw: String) -> String {
        let p = raw.split(separator: "|", maxSplits: 3).map(String.init)
        guard p.count >= 4, let ms = Double(p[0]) else { return raw }
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM d HH:mm"
        let time = fmt.string(from: Date(timeIntervalSince1970: ms / 1000))
        return "\(time)  \(p[1]) · \(p[2]) · \(p[3])"
    }

    /// Breadcrumb format is `"<epochMs>|<activityName>"`. Render as `HH:mm · name`.
    private static func format(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "never" }
        let parts = raw.split(separator: "|", maxSplits: 1).map(String.init)
        guard let ms = Double(parts.first ?? "") else { return raw }
        let date = Date(timeIntervalSince1970: ms / 1000)
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM d, HH:mm"
        let name = parts.count > 1 ? parts[1]
            .replacingOccurrences(of: "\(SharedScreenTime.scheduledActivityPrefix).", with: "") : ""
        return name.isEmpty ? fmt.string(from: date) : "\(fmt.string(from: date)) · \(name)"
    }
}
