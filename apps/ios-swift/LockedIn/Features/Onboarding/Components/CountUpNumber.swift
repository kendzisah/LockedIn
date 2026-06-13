import SwiftUI

/// CountUpNumber — animated integer count-up.
///
/// Used on Wake-Up Call (years lost) and StatReveal (OVR count from 0).
/// Resets and re-runs whenever `value` changes.
///
/// Port of `apps/mobile/src/features/onboarding/components/CountUpNumber.tsx`.
struct CountUpNumber: View {
    let value: Int
    let duration: Double
    let decimals: Int
    let startDelay: Double
    let format: ((Double) -> String)?

    @State private var display: Double = 0
    @State private var task: Task<Void, Never>? = nil

    init(
        value: Int,
        duration: Double = 1.2,
        decimals: Int = 0,
        startDelay: Double = 0,
        format: ((Double) -> String)? = nil
    ) {
        self.value = value
        self.duration = duration
        self.decimals = decimals
        self.startDelay = startDelay
        self.format = format
    }

    var body: some View {
        Text(displayText)
            .onAppear { run() }
            .onChange(of: value) { _, _ in run() }
            .onDisappear { task?.cancel() }
    }

    private var displayText: String {
        if let format { return format(display) }
        if decimals > 0 {
            return String(format: "%.\(decimals)f", display)
        }
        return String(Int(display.rounded()))
    }

    private func run() {
        task?.cancel()
        display = 0
        let target = Double(value)
        let dur = duration
        let sd = startDelay
        task = Task { @MainActor in
            if sd > 0 {
                try? await Task.sleep(nanoseconds: UInt64(sd * 1_000_000_000))
            }
            // ease-out cubic — fast start, soft landing
            let frames = max(1, Int(dur * 60))
            for f in 1...frames {
                if Task.isCancelled { return }
                let t = Double(f) / Double(frames)
                let eased = 1.0 - pow(1.0 - t, 3.0)
                display = target * eased
                try? await Task.sleep(nanoseconds: UInt64((1.0 / 60.0) * 1_000_000_000))
            }
            if !Task.isCancelled { display = target }
        }
    }
}
