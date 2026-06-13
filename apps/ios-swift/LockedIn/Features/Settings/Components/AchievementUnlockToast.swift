//
//  AchievementUnlockToast.swift
//  LockedIn
//
//  Global HUD overlay that listens for
//  `Notification.Name.achievementsUnlocked` and shows one toast per id.
//  Multiple unlocks queue and play sequentially so the user sees each
//  badge instead of just the last one in the batch.
//
//  Host this once at the root of the app:
//      RootNavigator()
//          .overlay(AchievementUnlockToastHost())
//

import SwiftUI
import DesignKit

/// Single toast view rendered when a new achievement unlocks. HUD-styled to
/// match `DurationPickerSheet` and the rest of the in-app vocabulary.
struct AchievementUnlockToast: View {
    let definition: AchievementDefinition

    var body: some View {
        ZStack {
            Rectangle()
                .fill(SystemTokens.panelBg)
                .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))

            HStack(spacing: 14) {
                ZStack {
                    Rectangle()
                        .fill(definition.category.color.opacity(0.15))
                    Rectangle()
                        .stroke(definition.category.color, lineWidth: 1)
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(definition.category.color)
                }
                .frame(width: 48, height: 48)
                .shadow(color: definition.category.color.opacity(0.5), radius: 8)

                VStack(alignment: .leading, spacing: 4) {
                    Text("// ACHIEVEMENT UNLOCKED")
                        .font(.custom(FontFamily.display.rawValue, size: 9))
                        .tracking(1.6)
                        .foregroundColor(SystemTokens.textMuted)
                    Text(definition.name)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 16))
                        .tracking(1.2)
                        .foregroundColor(definition.category.color)
                        .lineLimit(1)
                    Text(definition.description)
                        .font(.custom(FontFamily.body.rawValue, size: 11))
                        .foregroundColor(AppColors.textSecondary)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            HUDCornerBrackets(color: definition.category.color, pulses: false)
                .allowsHitTesting(false)
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Listens for `.achievementsUnlocked` and drives a sequential queue of
/// `AchievementUnlockToast` views. Each toast displays for `displayDuration`
/// seconds then slides out. Tapping a toast dismisses it immediately.
struct AchievementUnlockToastHost: View {
    @State private var queue: [String] = []
    @State private var current: AchievementDefinition?
    /// Bumped every time we advance the queue — gives `.task(id:)` a fresh
    /// id so the auto-dismiss timer restarts cleanly per toast.
    @State private var tick: Int = 0

    private let displayDuration: Duration = .seconds(3)

    var body: some View {
        VStack {
            if let current {
                AchievementUnlockToast(definition: current)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .transition(
                        .move(edge: .top).combined(with: .opacity)
                    )
                    .onTapGesture { advance() }
            }
            Spacer(minLength: 0)
        }
        .animation(.easeInOut(duration: 0.25), value: current?.id)
        .onReceive(NotificationCenter.default.publisher(for: .achievementsUnlocked)) { note in
            guard let ids = note.userInfo?["ids"] as? [String] else { return }
            enqueue(ids: ids)
        }
        .task(id: tick) {
            guard current != nil else { return }
            try? await Task.sleep(for: displayDuration)
            advance()
        }
    }

    private func enqueue(ids: [String]) {
        // Drop unknown ids defensively (shouldn't happen — server can only
        // unlock ids we sent in the candidate list).
        let valid = ids.filter { AchievementCatalog.byId[$0] != nil }
        queue.append(contentsOf: valid)
        if current == nil { advance() }
    }

    private func advance() {
        guard !queue.isEmpty else {
            current = nil
            return
        }
        let nextId = queue.removeFirst()
        current = AchievementCatalog.byId[nextId]
        tick &+= 1
    }
}
