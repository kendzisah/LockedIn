import SwiftUI

/// TypingText — character-by-character type-in for HUD/terminal screens.
///
/// Default behavior (`reserveSpace: false`) is unchanged: the bounding box
/// grows as characters land. Used by mono terminal lines like `> SYSTEM
/// INITIALIZING...` where reflow is intentional.
///
/// With `reserveSpace: true` the full final text is rendered up-front and
/// not-yet-typed characters are drawn in `.clear`, so multi-line wrapping
/// and parent layout don't shift mid-animation. Use this mode on headlines,
/// quiz prompts, and any text where surrounding chrome should hold position.
///
/// Honors `accessibilityReduceMotion`: when enabled, the full string renders
/// immediately and `onComplete` fires on the next runloop tick.
///
/// Port of `apps/mobile/src/features/onboarding/components/TypingText.tsx`.
struct TypingText: View {
    let text: String
    let charDelay: Double
    let startDelay: Double
    let reserveSpace: Bool
    let onComplete: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visibleCount: Int = 0
    @State private var task: Task<Void, Never>? = nil

    init(
        _ text: String,
        charDelay: Double = 0.04,
        startDelay: Double = 0,
        reserveSpace: Bool = false,
        onComplete: (() -> Void)? = nil
    ) {
        self.text = text
        self.charDelay = charDelay
        self.startDelay = startDelay
        self.reserveSpace = reserveSpace
        self.onComplete = onComplete
    }

    var body: some View {
        Group {
            if reserveSpace {
                Text(attributed)
            } else {
                Text(visibleSubstring)
            }
        }
        .onAppear { run() }
        .onChange(of: text) { _, _ in run() }
        .onDisappear { task?.cancel() }
    }

    private var visibleSubstring: String {
        guard visibleCount > 0 else { return "" }
        return String(text.prefix(visibleCount))
    }

    /// AttributedString where the not-yet-typed suffix is `.clear`. Layout is
    /// driven by the full string so wrapping, line count, and bounding box
    /// stay stable from the first frame.
    private var attributed: AttributedString {
        var full = AttributedString(text)
        let total = text.count
        guard visibleCount < total else { return full }
        let invisibleStartIndex = text.index(text.startIndex, offsetBy: visibleCount)
        let invisibleStartOffset = text.distance(from: text.startIndex, to: invisibleStartIndex)
        let attrStart = full.index(full.startIndex, offsetByCharacters: invisibleStartOffset)
        full[attrStart..<full.endIndex].foregroundColor = .clear
        return full
    }

    private func run() {
        task?.cancel()
        visibleCount = 0

        if reduceMotion {
            visibleCount = text.count
            // Fire onComplete on the next tick so callers chain animations
            // identically to the typed path.
            DispatchQueue.main.async { onComplete?() }
            return
        }

        let local = text
        let cd = charDelay
        let sd = startDelay
        let cb = onComplete
        task = Task { @MainActor in
            if sd > 0 {
                try? await Task.sleep(nanoseconds: UInt64(sd * 1_000_000_000))
            }
            for i in 1...local.count {
                if Task.isCancelled { return }
                visibleCount = i
                try? await Task.sleep(nanoseconds: UInt64(cd * 1_000_000_000))
            }
            if !Task.isCancelled {
                cb?()
            }
        }
    }
}
