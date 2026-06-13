import SwiftUI

/// Four-corner bracket overlay used by HUD panels.
///
/// Pulses with a 2000ms `easeInOut` cycle between full and reduced alpha,
/// per the Agent C fidelity spec.
public struct HUDCornerBrackets: View {
    public enum Corner: CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight
    }

    let length: CGFloat
    let thickness: CGFloat
    let color: Color
    let pulses: Bool

    @State private var pulsePhase: Double = 1.0

    public init(
        length: CGFloat = 14,
        thickness: CGFloat = 1.5,
        color: Color = SystemTokens.bracketColor,
        pulses: Bool = true
    ) {
        self.length = length
        self.thickness = thickness
        self.color = color
        self.pulses = pulses
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(Corner.allCases, id: \.self) { corner in
                    bracket(in: proxy.size, corner: corner)
                }
            }
            .opacity(pulsePhase)
            .onAppear {
                guard pulses else { return }
                withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                    pulsePhase = 0.4
                }
            }
        }
        .allowsHitTesting(false)
    }

    @ViewBuilder
    private func bracket(in size: CGSize, corner: Corner) -> some View {
        let (origin, hFlip, vFlip): (CGPoint, Bool, Bool) = {
            switch corner {
            case .topLeft:     return (CGPoint(x: 0, y: 0), false, false)
            case .topRight:    return (CGPoint(x: size.width, y: 0), true, false)
            case .bottomLeft:  return (CGPoint(x: 0, y: size.height), false, true)
            case .bottomRight: return (CGPoint(x: size.width, y: size.height), true, true)
            }
        }()

        Path { path in
            let hSign: CGFloat = hFlip ? -1 : 1
            let vSign: CGFloat = vFlip ? -1 : 1
            path.move(to: CGPoint(x: origin.x + hSign * length, y: origin.y))
            path.addLine(to: origin)
            path.addLine(to: CGPoint(x: origin.x, y: origin.y + vSign * length))
        }
        .stroke(color, lineWidth: thickness)
    }
}
