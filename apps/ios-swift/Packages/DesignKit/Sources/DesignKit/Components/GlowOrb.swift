import SwiftUI

/// Ambient glow orb — an absolutely-positioned blurred circle used behind
/// content to add depth. Use 1-2 per screen.
///
/// Presets: blue `rgba(58,102,255,0.06)`, cyan `rgba(0,194,255,0.05)`.
public struct GlowOrb: View {
    public enum Preset {
        case blue
        case cyan

        var color: Color {
            switch self {
            case .blue: return Color(.sRGB, red: 58/255,  green: 102/255, blue: 255/255, opacity: 0.06)
            case .cyan: return Color(.sRGB, red: 0/255,   green: 194/255, blue: 255/255, opacity: 0.05)
            }
        }
    }

    let color: Color
    let size: CGFloat
    let blurRadius: CGFloat

    public init(preset: Preset = .blue, size: CGFloat = 220, blurRadius: CGFloat = 40) {
        self.color = preset.color
        self.size = size
        self.blurRadius = blurRadius
    }

    public init(color: Color, size: CGFloat = 220, blurRadius: CGFloat = 40) {
        self.color = color
        self.size = size
        self.blurRadius = blurRadius
    }

    public var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .blur(radius: blurRadius)
            .allowsHitTesting(false)
    }
}
