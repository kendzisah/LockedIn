import SwiftUI
import DesignKit

/// FocusRing — HUD focus panel. Renders a reticle-style ring with a
/// gradient-stroke progress arc, a daily-goal StatBar, and an
/// `ACTIVATE SESSION` button wired into the duration picker.
///
/// Ported from `apps/mobile/src/features/home/components/FocusRing.tsx`:
///   - Ring size 150, stroke 6.
///   - Progress arc rotated `-90°` so 0% sits at 12 o'clock.
///   - 4 reticle tick marks at 12 / 3 / 6 / 9, opacity 0.45.
///   - 800ms `easeOut` fill animation.
///   - Idle "breathe" loop (0.6 ↔ 1, 1500ms each direction) when focused == 0.
///   - At-risk variant repaints the ring red and tints the activate button.
struct FocusRing: View {
    let focused: Int
    let goal: Int
    let streakAtRisk: Bool
    let onActivate: () -> Void
    /// Expand the minimized tracker back to the full timer screen.
    let onOpenTimer: () -> Void

    @Environment(ActiveSessionStore.self) private var session

    private let size: CGFloat = 150
    private let strokeWidth: CGFloat = 6

    @State private var animatedProgress: Double = 0
    @State private var breathe: Double = 0.6

    init(
        focused: Int,
        goal: Int,
        streakAtRisk: Bool = false,
        onActivate: @escaping () -> Void,
        onOpenTimer: @escaping () -> Void = {}
    ) {
        self.focused = focused
        self.goal = goal
        self.streakAtRisk = streakAtRisk
        self.onActivate = onActivate
        self.onOpenTimer = onOpenTimer
    }

    private var progress: Double {
        goal > 0 ? min(1.0, Double(focused) / Double(goal)) : 0
    }

    private var ringColor: Color {
        streakAtRisk ? SystemTokens.red : SystemTokens.glowAccent
    }
    private var ringColorLight: Color {
        streakAtRisk ? Color(hex: "#FF6B81") : SystemTokens.cyan
    }

    var body: some View {
        if session.isActive {
            activeTrackerPanel
        } else {
            idlePanel
        }
    }

    // MARK: - Active tracker (minimized live timer)

    private var trackerColor: Color {
        session.isOnBreak ? SystemTokens.gold : SystemTokens.glowAccent
    }

    private var activeTrackerPanel: some View {
        HUDPanel(
            headerLabel: "FOCUS",
            headerRight: session.isOnBreak ? "ON BREAK" : "LOCKED IN",
            accentColor: trackerColor
        ) {
            VStack(spacing: 0) {
                Button(action: onOpenTimer) {
                    trackerRing
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressOpacityButtonStyle())

                if session.isOnBreak {
                    trackerActionButton(
                        title: "▸  END BREAK NOW",
                        color: SystemTokens.glowAccent,
                        action: { session.endBreakEarly() }
                    )
                } else if session.breaksRemainingToday > 0 {
                    trackerActionButton(
                        title: "❚❚  TAKE A BREAK · \(session.breaksRemainingToday) LEFT",
                        color: SystemTokens.cyan,
                        action: { session.startBreak(seconds: 60) }
                    )
                } else {
                    trackerActionButton(
                        title: "NO BREAKS LEFT TODAY",
                        color: SystemTokens.textMuted,
                        action: {}
                    )
                    .disabled(true)
                }

                Text("TAP THE RING TO EXPAND")
                    .font(.custom(FontFamily.body.rawValue, size: 9))
                    .tracking(1)
                    .foregroundColor(SystemTokens.textMuted)
                    .padding(.top, 8)
            }
        }
    }

    private var trackerRing: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.06), lineWidth: strokeWidth)
                .frame(width: size, height: size)

            ReticleTicks(size: size, color: trackerColor)

            Circle()
                .trim(from: 0, to: min(1.0, session.progress))
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [trackerColor, SystemTokens.cyan, trackerColor]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
                )
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-90))

            VStack(spacing: -2) {
                Text(SessionTimeFormatter.format(
                    seconds: session.isOnBreak ? session.breakRemainingSeconds : session.remainingSeconds
                ))
                    .font(.custom(FontFamily.headingBold.rawValue, size: 34))
                    .monospacedDigit()
                    .tracking(-1)
                    .foregroundColor(session.isOnBreak ? trackerColor : SystemTokens.textPrimary)
                Text(session.isOnBreak ? "on break" : "remaining")
                    .font(.custom(FontFamily.body.rawValue, size: 10))
                    .tracking(0.4)
                    .foregroundColor(SystemTokens.textMuted)
                    .padding(.top, 4)
            }
            .allowsHitTesting(false)
        }
        .frame(width: size, height: size)
    }

    private func trackerActionButton(title: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                .tracking(2.0)
                .foregroundColor(color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(color.opacity(0.12))
                .overlay(Rectangle().stroke(color.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(PressOpacityButtonStyle())
        .padding(.top, 12)
    }

    // MARK: - Idle (daily-goal ring)

    private var idlePanel: some View {
        HUDPanel(
            headerLabel: "FOCUS",
            headerRight: "\(focused)/\(goal) MIN",
            accentColor: ringColor
        ) {
            VStack(spacing: 0) {
                ringView
                    .padding(.vertical, 6)

                HUDStatBar(
                    label: "GOAL",
                    valueText: "\(focused)/\(goal)",
                    current: Double(focused),
                    max: Double(max(goal, 1)),
                    color: ringColor,
                    labelWidth: 36,
                    valueWidth: 48
                )
                .padding(.top, 10)
                .padding(.bottom, 12)

                Button(action: onActivate) {
                    Text("⟐  ACTIVATE SESSION")
                        .font(.custom(FontFamily.headingBold.rawValue, size: 13))
                        .tracking(2.0)
                        .foregroundColor(streakAtRisk ? SystemTokens.red : SystemTokens.glowAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            streakAtRisk
                                ? Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.12)
                                : Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12)
                        )
                        .overlay(
                            Rectangle()
                                .stroke(
                                    streakAtRisk
                                        ? Color(.sRGB, red: 255/255, green: 71/255, blue: 87/255, opacity: 0.40)
                                        : Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.35),
                                    lineWidth: 1
                                )
                        )
                }
                .buttonStyle(PressOpacityButtonStyle())
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                animatedProgress = progress
            }
            startBreathing()
        }
        .onChange(of: progress) { _, newValue in
            withAnimation(.easeOut(duration: 0.8)) {
                animatedProgress = newValue
            }
        }
        .onChange(of: focused) { _, newValue in
            startBreathing()
            if newValue != 0 { breathe = 1.0 }
        }
    }

    @ViewBuilder
    private var ringView: some View {
        ZStack {
            // Track
            Circle()
                .stroke(Color.white.opacity(0.06), lineWidth: strokeWidth)
                .frame(width: size, height: size)

            // Reticle ticks at 12 / 3 / 6 / 9
            ReticleTicks(size: size, color: ringColor)

            // Progress arc with gradient stroke (rotated to start at top)
            Circle()
                .trim(from: 0, to: animatedProgress)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [ringColor, ringColorLight, ringColor]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round)
                )
                .frame(width: size, height: size)
                .rotationEffect(.degrees(-90))

            // Center readout
            VStack(spacing: -2) {
                Text("\(focused)")
                    .font(.custom(FontFamily.headingBold.rawValue, size: 44))
                    .tracking(-1)
                    .foregroundColor(SystemTokens.textPrimary)
                Text("min")
                    .font(.custom(FontFamily.bodyMedium.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textSecondary)
                Text("focused today")
                    .font(.custom(FontFamily.body.rawValue, size: 10))
                    .tracking(0.4)
                    .foregroundColor(SystemTokens.textMuted)
                    .padding(.top, 2)
            }
            .allowsHitTesting(false)
        }
        .frame(width: size, height: size)
        .opacity(focused == 0 ? breathe : 1.0)
    }

    private func startBreathing() {
        guard focused == 0 else { return }
        breathe = 0.6
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            breathe = 1.0
        }
    }
}

/// Four-tick reticle drawn at 12 / 3 / 6 / 9 around a ring.
private struct ReticleTicks: View {
    let size: CGFloat
    let color: Color

    var body: some View {
        Canvas { context, _ in
            let half = size / 2
            context.opacity = 0.45
            let lineWidth: CGFloat = 1
            // 12 o'clock
            var p1 = Path()
            p1.move(to: CGPoint(x: half, y: 2))
            p1.addLine(to: CGPoint(x: half, y: 8))
            context.stroke(p1, with: .color(color), lineWidth: lineWidth)
            // 3 o'clock
            var p2 = Path()
            p2.move(to: CGPoint(x: size - 8, y: half))
            p2.addLine(to: CGPoint(x: size - 2, y: half))
            context.stroke(p2, with: .color(color), lineWidth: lineWidth)
            // 6 o'clock
            var p3 = Path()
            p3.move(to: CGPoint(x: half, y: size - 8))
            p3.addLine(to: CGPoint(x: half, y: size - 2))
            context.stroke(p3, with: .color(color), lineWidth: lineWidth)
            // 9 o'clock
            var p4 = Path()
            p4.move(to: CGPoint(x: 2, y: half))
            p4.addLine(to: CGPoint(x: 8, y: half))
            context.stroke(p4, with: .color(color), lineWidth: lineWidth)
        }
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }
}
