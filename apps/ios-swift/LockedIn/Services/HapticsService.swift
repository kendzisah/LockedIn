import UIKit

/// Replaces `expo-haptics`. Singleton that lazily holds generators so taps
/// fire with minimal latency.
public final class HapticsService {
    public static let shared = HapticsService()

    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let rigidImpact = UIImpactFeedbackGenerator(style: .rigid)
    private let softImpact = UIImpactFeedbackGenerator(style: .soft)
    private let notification = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    private init() {}

    public func light()  { lightImpact.prepare();  lightImpact.impactOccurred() }
    public func medium() { mediumImpact.prepare(); mediumImpact.impactOccurred() }
    public func heavy()  { heavyImpact.prepare();  heavyImpact.impactOccurred() }
    public func rigid()  { rigidImpact.prepare();  rigidImpact.impactOccurred() }
    public func soft()   { softImpact.prepare();   softImpact.impactOccurred() }

    public func success() { notification.prepare(); notification.notificationOccurred(.success) }
    public func warning() { notification.prepare(); notification.notificationOccurred(.warning) }
    public func error()   { notification.prepare(); notification.notificationOccurred(.error) }

    public func selectionChanged() { selection.prepare(); selection.selectionChanged() }
}
