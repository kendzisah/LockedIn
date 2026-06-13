import SwiftUI
import DesignKit

/// HUDPanel-wrapped section with header label and hairline dividers between
/// children. Port of
/// `apps/mobile/src/features/settings/components/SettingsSection.tsx`.
///
/// Children are typically `SettingsRow` instances. The divider inherits
/// `SystemTokens.divider` and is inset 36pt from the left to align with the
/// row label column (the icon column is 36pt wide).
struct SettingsSection<Content: View>: View {
    let label: String
    let content: Content

    init(_ label: String, @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }

    var body: some View {
        HUDPanel(headerLabel: label.uppercased()) {
            // We use `_VariadicView_Tree` via `_VariadicView.Tree` to insert
            // dividers between arbitrary child views. SwiftUI doesn't expose
            // an out-of-the-box "insert separator between children" API.
            _VariadicView.Tree(SeparatedLayout()) { content }
        }
    }
}

/// Layout helper that renders its variadic children with a hairline divider
/// between consecutive items.
private struct SeparatedLayout: _VariadicView_MultiViewRoot {
    @ViewBuilder
    func body(children: _VariadicView.Children) -> some View {
        let count = children.count
        VStack(spacing: 0) {
            ForEach(Array(children.enumerated()), id: \.element.id) { index, child in
                child
                if index < count - 1 {
                    Rectangle()
                        .fill(SystemTokens.divider)
                        .frame(height: 0.5)
                        .padding(.leading, 36)
                }
            }
        }
    }
}
