import ManagedSettings
import ManagedSettingsUI
import UIKit

/// ShieldConfigurationExtension — branded shield rendered when Family
/// Controls blocks an app/web domain during an active lock-in.
///
/// The four overrides cover every shielding entry point Apple ships:
/// - Application (a single blocked app)
/// - Application in ActivityCategory (an app inside a blocked category)
/// - WebDomain (a single blocked web domain)
/// - WebDomain in ActivityCategory (a domain inside a blocked category)
///
/// All four return the same `ShieldConfiguration` — the user experience is
/// identical regardless of what they tapped. No buttons in v1 so the user
/// has no escape hatch besides ending the session in the LockedIn app
/// (matches the brief's "frozen decisions" note: "Shield extension: no
/// buttons in v1").
class ShieldConfigurationExtension: ShieldConfigurationDataSource {

    override func configuration(shielding application: Application) -> ShieldConfiguration {
        Self.lockedInShield
    }

    override func configuration(shielding application: Application,
                                in category: ActivityCategory) -> ShieldConfiguration {
        Self.lockedInShield
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        Self.lockedInShield
    }

    override func configuration(shielding webDomain: WebDomain,
                                in category: ActivityCategory) -> ShieldConfiguration {
        Self.lockedInShield
    }

    /// Hardcoded color constants — extensions have stricter linking than the
    /// host app, so we avoid pulling in DesignKit here. Values match
    /// `DesignKit.AppColors.lockInActive` (#090C10) and
    /// `DesignKit.AppColors.primary` (#3A66FF / Discipline Blue).
    private static var lockedInShield: ShieldConfiguration {
        let lockedInBg = UIColor(red: 9/255, green: 12/255, blue: 16/255, alpha: 1.0)
        let disciplineBlue = UIColor(red: 58/255, green: 102/255, blue: 255/255, alpha: 1.0)

        let lockIcon: UIImage? = {
            let cfg = UIImage.SymbolConfiguration(pointSize: 56, weight: .bold)
            return UIImage(systemName: "lock.fill", withConfiguration: cfg)?
                .withTintColor(disciplineBlue, renderingMode: .alwaysOriginal)
        }()

        return ShieldConfiguration(
            backgroundBlurStyle: .systemMaterialDark,
            backgroundColor: lockedInBg,
            icon: lockIcon,
            title: ShieldConfiguration.Label(
                text: "You are currently Locked In",
                color: .white
            ),
            subtitle: ShieldConfiguration.Label(
                text: "Don't let temptation defeat you.",
                color: UIColor(white: 1.0, alpha: 0.65)
            ),
            primaryButtonLabel: nil,
            secondaryButtonLabel: nil
        )
    }
}
