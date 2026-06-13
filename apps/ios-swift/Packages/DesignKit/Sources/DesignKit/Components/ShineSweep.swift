import SwiftUI

/// A diagonal specular highlight that sweeps across the surface it's applied
/// to. Rendered via `TimelineView` + `Canvas` so it ticks at display refresh
/// without forcing a `@State` re-render, and clipped to the parent shape so
/// it can't bleed past the button edge.
///
/// **DO NOT** use this as a ZStack sibling — historical regression: `GeometryReader`
/// inside the gradient expanded to fill the ZStack's parent, which made every
/// button it touched grow to fill the entire available width *and* height.
///
/// Apply via the `.shineSweep()` view modifier instead:
///
/// ```swift
/// PrimaryButton("Sign Up") { ... }
///     .shineSweep()
/// ```
public struct ShineSweep: View {
    /// Full animation cycle (active sweep + idle gap). Default 3.2s.
    let cycle: Double
    /// Active translation duration within a cycle. Default 1.4s.
    let translation: Double
    /// Band width as a fraction of the parent width. Default 0.28 — a thin
    /// gloss, not a glow.
    let bandFraction: CGFloat
    /// Peak alpha of the highlight. Default 0.18 (subtle, premium).
    let peakAlpha: Double

    public init(
        cycle: Double = 3.2,
        translation: Double = 1.4,
        bandFraction: CGFloat = 0.28,
        peakAlpha: Double = 0.18
    ) {
        self.cycle = cycle
        self.translation = translation
        self.bandFraction = bandFraction
        self.peakAlpha = peakAlpha
    }

    public var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: false)) { context in
            Canvas { ctx, size in
                let t = phaseFor(time: context.date.timeIntervalSinceReferenceDate)
                let band = max(8, size.width * bandFraction)
                // Sweep from off-left to off-right so it enters/exits cleanly.
                let travel = size.width + band
                let x = -band + travel * t
                let rect = CGRect(
                    x: x,
                    y: -size.height * 0.15,
                    width: band,
                    height: size.height * 1.30
                )

                // Skew the band ~12° for a more premium specular feel.
                let skew: CGFloat = 0.21
                var transform = CGAffineTransform.identity
                transform = transform.translatedBy(x: rect.midX, y: rect.midY)
                transform = transform.concatenating(
                    CGAffineTransform(a: 1, b: 0, c: skew, d: 1, tx: 0, ty: 0)
                )
                transform = transform.translatedBy(x: -rect.midX, y: -rect.midY)
                ctx.transform = transform

                let gradient = Gradient(stops: [
                    .init(color: .white.opacity(0.0),           location: 0.00),
                    .init(color: .white.opacity(peakAlpha * 0.55), location: 0.35),
                    .init(color: .white.opacity(peakAlpha),     location: 0.50),
                    .init(color: .white.opacity(peakAlpha * 0.55), location: 0.65),
                    .init(color: .white.opacity(0.0),           location: 1.00),
                ])
                ctx.fill(
                    Path(rect),
                    with: .linearGradient(
                        gradient,
                        startPoint: CGPoint(x: rect.minX, y: rect.midY),
                        endPoint:   CGPoint(x: rect.maxX, y: rect.midY)
                    )
                )
            }
            .blendMode(.plusLighter)
            .allowsHitTesting(false)
        }
    }

    /// Maps wall-clock seconds → 0…1 sweep phase. The band is active for
    /// `translation` seconds within each `cycle`, then idle for the
    /// remainder. The hash on `cycle` desynchronises multiple buttons on
    /// screen so they don't strobe in unison.
    private func phaseFor(time: TimeInterval) -> CGFloat {
        let local = time.truncatingRemainder(dividingBy: cycle)
        guard local < translation else { return 1 }
        let raw = local / translation
        // Ease-in-out for a more natural sweep.
        let eased = raw < 0.5
            ? 2.0 * raw * raw
            : 1.0 - pow(-2.0 * raw + 2.0, 2.0) / 2.0
        return CGFloat(eased)
    }
}

// MARK: - View modifier convenience

public extension View {
    /// Overlay a periodic specular shine on this view, clipped to the
    /// supplied corner radius. Sized by the host view; the shine never
    /// expands the layout.
    ///
    /// ```swift
    /// PrimaryButton("Continue") { ... }
    ///     .shineSweep(cornerRadius: 14)
    /// ```
    func shineSweep(
        cornerRadius: CGFloat = 14,
        cycle: Double = 3.2,
        translation: Double = 1.4,
        bandFraction: CGFloat = 0.28,
        peakAlpha: Double = 0.18
    ) -> some View {
        overlay(
            ShineSweep(
                cycle: cycle,
                translation: translation,
                bandFraction: bandFraction,
                peakAlpha: peakAlpha
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        )
    }
}
