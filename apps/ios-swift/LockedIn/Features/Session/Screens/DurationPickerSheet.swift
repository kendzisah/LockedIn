//
//  DurationPickerSheet.swift
//  LockedIn — Worker W11 (Session / Lock-In feature)
//
//  Port of `apps/mobile/src/navigation/MainNavigator.tsx` DurationPickerModal.
//  Reproduces the recent HUD redesign (commit `6210cbb`):
//   - No rounded card (paddingHorizontal 18, paddingTop 14, paddingBottom 16)
//   - Header strip: `// LOCK IN` SectionLabelStyle + LinearGradient rule +
//     "CHOOSE FOCUS DURATION" InterTight 800 10px tracking 1.6
//   - HUDCornerBrackets inside the card
//   - Preset options: 3-up grid, left-border 2px accent, no full border
//   - Custom Duration glass row with cyan left-border accent
//   - Custom view: two SwiftUI wheel pickers (Hours 0-23, Minutes 0-59)
//     and a START block CTA with `⟐` ornament.
//
//  Presented from the parent navigation shell as a fullscreenCover with a
//  black 0.75 backdrop (matches RN `rgba(0,0,0,0.75)` overlay). When the
//  user selects a duration, this sheet calls `onConfirm(minutes)` with the
//  chosen value — the parent navigator is responsible for the paywall gate
//  + ExecutionBlock navigation (mirrors RN `handleSelect` which checks
//  `isSubscribed` and dispatches `rootNavigationRef.navigate`).
//

import SwiftUI
import DesignKit

public struct DurationPickerSheet: View {
    /// Match RN `DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]`.
    public static let presetMinutes: [Int] = [15, 30, 45, 60, 90, 120]

    @Binding var isPresented: Bool
    /// `(durationMinutes, hardcore)`.
    let onConfirm: (Int, Bool) -> Void

    @State private var showCustom: Bool = false
    @State private var customHours: Int = 0
    @State private var customMinutes: Int = 30
    @State private var pressedOption: Int? = nil
    @State private var hardcore: Bool = false

    public init(
        isPresented: Binding<Bool>,
        onConfirm: @escaping (Int, Bool) -> Void
    ) {
        self._isPresented = isPresented
        self.onConfirm = onConfirm
    }

    public var body: some View {
        ZStack {
            // Black 0.75 backdrop (RN `dp.overlay`). Tap to dismiss.
            Color.black.opacity(0.75)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { isPresented = false }

            card
                .padding(.horizontal, 20)
        }
        .transition(.opacity)
        .animation(.easeInOut(duration: 0.2), value: isPresented)
    }

    // MARK: - HUD card

    private var card: some View {
        ZStack {
            // Panel bg
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(
                    Rectangle()
                        .stroke(SystemTokens.panelBorder, lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 0) {
                header

                if showCustom {
                    customView
                        .padding(.top, 16)
                } else {
                    presetView
                        .padding(.top, 16)
                }

                hardcoreToggle
                    .padding(.top, 12)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 16)

            // Corner brackets sit above everything (no hit testing)
            HUDCornerBrackets(color: SystemTokens.bracketColor, pulses: false)
                .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Hardcore toggle

    private var hardcoreToggle: some View {
        Toggle(isOn: $hardcore) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 12))
                        .foregroundColor(hardcore ? SystemTokens.red : SystemTokens.textMuted)
                    Text("HARDCORE MODE")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                        .tracking(1.4)
                        .foregroundColor(hardcore ? SystemTokens.red : SystemTokens.textSecondary)
                }
                Text("No early exit. No breaks. Commit now.")
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.textMuted)
            }
        }
        .tint(SystemTokens.red)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            HStack(spacing: 0) {
                Rectangle()
                    .fill(hardcore ? SystemTokens.red : Color.white.opacity(0.06))
                    .frame(width: 2)
                (hardcore ? SystemTokens.red.opacity(0.08) : Color.white.opacity(0.02))
            }
        )
    }

    // MARK: - Header strip

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("// LOCK IN")
                .sectionLabel()
            LinearGradient(
                colors: [SystemTokens.bracketColor, .clear],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 1)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
            Text("CHOOSE FOCUS DURATION")
                .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                .tracking(1.6)
                .foregroundColor(SystemTokens.textMuted)
                .padding(.top, 2)
        }
    }

    // MARK: - Preset grid + custom button + cancel

    private var presetView: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 3-column grid using a manual layout to match `flexBasis: 31.5%`.
            let cols = [GridItem(.flexible(), spacing: 8),
                        GridItem(.flexible(), spacing: 8),
                        GridItem(.flexible(), spacing: 8)]
            LazyVGrid(columns: cols, spacing: 8) {
                ForEach(Self.presetMinutes, id: \.self) { mins in
                    presetCell(mins)
                }
            }

            // CUSTOM DURATION row
            customDurationRow

            // Cancel
            Button {
                isPresented = false
            } label: {
                Text("Cancel")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
    }

    private func presetCell(_ mins: Int) -> some View {
        let isPressed = pressedOption == mins
        let pair = formatDuration(mins)
        return Button {
            HapticsService.shared.selectionChanged()
            isPresented = false
            onConfirm(mins, hardcore)
        } label: {
            VStack(spacing: 2) {
                Text(pair.value)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 26))
                    .tracking(-0.5)
                    .foregroundColor(isPressed ? SystemTokens.glowAccent : SystemTokens.textPrimary)
                    .shadow(
                        color: isPressed ? SystemTokens.glowAccent : .clear,
                        radius: 6, x: 0, y: 0
                    )
                Text(pair.label.uppercased())
                    .font(.custom(FontFamily.headingBold.rawValue, size: 9))
                    .tracking(1.4)
                    .foregroundColor(isPressed ? SystemTokens.glowAccent : SystemTokens.textMuted)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 72)
            .background(
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(isPressed ? SystemTokens.glowAccent : Color.white.opacity(0.06))
                        .frame(width: 2)
                    (isPressed
                        ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.14)
                        : Color.white.opacity(0.02))
                }
            )
        }
        .buttonStyle(PressableButtonStyle(onPress: { pressed in
            pressedOption = pressed ? mins : nil
        }))
    }

    private var customDurationRow: some View {
        Button {
            showCustom = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "timer")
                    .font(.system(size: 14))
                    .foregroundColor(SystemTokens.cyan)
                Text("CUSTOM DURATION")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                    .tracking(1.4)
                    .foregroundColor(SystemTokens.cyan)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(SystemTokens.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color(.sRGB, red: 0/255, green: 194/255, blue: 255/255, opacity: 0.45))
                        .frame(width: 2)
                    Color.white.opacity(0.02)
                }
            )
        }
        .buttonStyle(PressOpacityButtonStyle())
    }

    // MARK: - Custom hours/minutes picker

    private var customView: some View {
        VStack(spacing: 14) {
            ZStack {
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.35))
                        .frame(width: 2)
                    Color.white.opacity(0.02)
                }
                .ignoresSafeArea(edges: .horizontal)

                VStack(spacing: 0) {
                    HStack(alignment: .center, spacing: 4) {
                        wheelPicker(
                            label: "Hours",
                            values: Array(0...23),
                            selection: $customHours
                        )
                        VStack(spacing: 6) {
                            Rectangle().fill(SystemTokens.textMuted).frame(width: 4, height: 4)
                            Rectangle().fill(SystemTokens.textMuted).frame(width: 4, height: 4)
                        }
                        .padding(.top, 24)
                        wheelPicker(
                            label: "Minutes",
                            values: Array(0...59),
                            selection: $customMinutes
                        )
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 12)

                    // Summary row
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 12))
                            .foregroundColor(SystemTokens.textMuted)
                        Text(summaryString)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 11))
                            .tracking(1.2)
                            .foregroundColor(SystemTokens.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .padding(.horizontal, 8)
                    .overlay(
                        Rectangle()
                            .fill(SystemTokens.divider)
                            .frame(height: 1)
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, 8),
                        alignment: .top
                    )
                }
                .padding(.horizontal, 8)
            }
            .frame(maxWidth: .infinity)
            .fixedSize(horizontal: false, vertical: true)

            // START BLOCK CTA. Enforce the iOS DeviceActivity 15-min minimum
            // (same `ScheduledSession.minWindowMinutes`): shorter intervals get
            // clamped to ~16 min for the OS un-shield backstop, so a killed app
            // wouldn't un-block a sub-15-min session at its real end.
            let totalMinutes = customHours * 60 + customMinutes
            let belowMinimum = totalMinutes < ScheduledSession.minWindowMinutes
            if totalMinutes > 0 && belowMinimum {
                Text("Minimum \(ScheduledSession.minWindowMinutes) minutes")
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.gold)
                    .frame(maxWidth: .infinity)
            }
            Button {
                guard !belowMinimum else { return }
                HapticsService.shared.medium()
                isPresented = false
                onConfirm(totalMinutes, hardcore)
            } label: {
                Text(startButtonTitle)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                    .tracking(1.6)
                    .foregroundColor(SystemTokens.glowAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.18))
                    .overlay(
                        Rectangle()
                            .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.45), lineWidth: 1)
                    )
                    .opacity(belowMinimum ? 0.35 : 1.0)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(belowMinimum)

            // Back
            Button {
                showCustom = false
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12))
                        .foregroundColor(SystemTokens.textMuted)
                    Text("Back")
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                        .foregroundColor(SystemTokens.textMuted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
    }

    @ViewBuilder
    private func wheelPicker(label: String, values: [Int], selection: Binding<Int>) -> some View {
        VStack(spacing: 10) {
            Text(label.uppercased())
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 11))
                .tracking(1)
                .foregroundColor(SystemTokens.textMuted)
            Picker(label, selection: selection) {
                ForEach(values, id: \.self) { v in
                    Text(padTwo(v))
                        .font(.custom(FontFamily.headingBold.rawValue, size: 22))
                        .foregroundColor(SystemTokens.textPrimary)
                        .tag(v)
                }
            }
            .pickerStyle(.wheel)
            .frame(width: 100, height: 140)
            .clipped()
        }
    }

    private var summaryString: String {
        if customHours == 0 && customMinutes == 0 {
            return "Select a duration"
        }
        var parts: [String] = []
        if customHours > 0 { parts.append("\(customHours)h") }
        if customMinutes > 0 { parts.append("\(customMinutes)m") }
        return parts.joined(separator: " ")
    }

    private var startButtonTitle: String {
        // Mirrors `⟐ START {h}H {m}M BLOCK` literal from RN.
        var middle = ""
        if customHours > 0 { middle += "\(customHours)H" }
        if customMinutes > 0 {
            if !middle.isEmpty { middle += " " }
            middle += "\(customMinutes)M"
        }
        if middle.isEmpty {
            return "⟐  START BLOCK"
        }
        return "⟐  START \(middle) BLOCK"
    }

    // MARK: - Helpers

    private func formatDuration(_ mins: Int) -> (value: String, label: String) {
        if mins < 60 {
            return (value: "\(mins)", label: "min")
        }
        if mins % 60 == 0 {
            let hours = mins / 60
            return (value: "\(hours)", label: hours == 1 ? "hour" : "hours")
        }
        // Fractional hour (e.g. 90 → "1.5"). Strip trailing ".0" for safety,
        // though the % 60 == 0 branch above already handles whole hours.
        let hours = Double(mins) / 60.0
        let formatted = String(format: "%.1f", hours)
        return (value: formatted, label: "hours")
    }

    private func padTwo(_ v: Int) -> String {
        String(format: "%02d", v)
    }
}

// MARK: - Pressable button style (track pressed transitions)

/// Calls `onPress(true)` on touch-down and `onPress(false)` on release —
/// used by the duration preset cells to drive the glow/shadow accent.
private struct PressableButtonStyle: ButtonStyle {
    let onPress: (Bool) -> Void
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .onChange(of: configuration.isPressed) { _, newValue in
                onPress(newValue)
            }
    }
}
