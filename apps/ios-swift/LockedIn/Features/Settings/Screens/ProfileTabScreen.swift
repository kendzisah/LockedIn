import SwiftUI
import DesignKit
import StoreKit
import Supabase

/// Profile tab (route `ProfileTab` in TabParamList). Port of
/// `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`.
///
/// Sections (top → bottom):
///   1. PLAYER + IDENTITY (avatar / display name / email or guest CTA)
///   2. SYSTEM STATS (`SystemStatsCard` — OVR + rank + 5 stat bars)
///   3. ACHIEVEMENTS (`AchievementsRow`)
///   4. RECORDS (`RecordsPanel` — lifetime stats)
///   5. Your plan (daily commitment / primary goal / focus areas / blocked apps)
///   6. Notifications (master / daily reminder / streak alerts / guild)
///   7. Subscription (entitlement state / restore / upgrade)
///   8. Account (change password / sign out / delete OR sign-up / sign-in / reset)
///   9. About (feedback / rate / share / privacy / terms / version)
///
/// Cross-feature dependencies:
/// - `AuthState`               (W1): user, sign-out, deleteAccount
/// - `SubscriptionState`       (W6): isSubscribed, restorePurchases, presentPaywall
/// - W2 OnboardingState        : daily minutes + primary goal + weaknesses (this
///                                screen owns the writes via SettingsState; the
///                                coordinator wires the bridge so both stay in sync)
/// - W3 StatsService / RankService: live `UserStatsLite` + `RankLite` (currently
///                                   defaulted; coordinator threads them in)
/// - W11 LockModeService        : blocked-app picker (count + present picker)
/// - W1 `EditProfileScreen`    : navigation target for `EditProfile { source: 'profile' }`
public struct ProfileTabScreen: View {

    // MARK: - Environment dependencies

    @Environment(AuthState.self) private var auth
    @Environment(SubscriptionState.self) private var subscription
    @Environment(SettingsState.self) private var settings

    // MARK: - Local UI state

    @State private var sheet: SettingsSheet?
    @State private var showSignOutConfirm: Bool = false
    @State private var showRestoreAlert: Bool = false
    @State private var restoreMessage: String = ""
    @State private var restoring: Bool = false
    @State private var showEditProfile: Bool = false
    @State private var showSignIn: Bool = false
    @State private var showSignUp: Bool = false
    @State private var showPaywallOffer: Bool = false

    // Live data (W3/W11/W4 wire these once their services land).
    @State private var stats: UserStatsLite? = nil
    @State private var rank: RankLite = RankLite()
    @State private var blockedAppCount: Int = 0
    @State private var loadingAppPicker: Bool = false
    @State private var showFamilyControlsDeniedAlert: Bool = false
    @State private var earnedAchievements: Set<String> = []
    @State private var detailAchievementId: String?

    // MARK: - Init

    public init() {}

    // MARK: - Body

    public var body: some View {
        ZStack {
            // Gradient + glow orb to match RN.
            LinearGradient(
                stops: [
                    Gradient.Stop(color: Color(hex: "#0A1628"), location: 0.0),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 0.55),
                    Gradient.Stop(color: Color(hex: "#0E1116"), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            GlowOrb(preset: .blue, size: 220, blurRadius: 40)
                .offset(x: 120, y: -260)
                .allowsHitTesting(false)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    playerPanel
                    identityPanel
                    SystemStatsCard(stats: stats, rank: rank)
                    AchievementsRow(
                        earnedCount: earnedAchievements.count,
                        totalCount: AchievementCatalog.all.count,
                        entries: AchievementCatalog.all.map { def in
                            AchievementsRow.Entry(
                                id: def.id,
                                name: def.name,
                                earned: earnedAchievements.contains(def.id),
                                categoryColor: def.category.color
                            )
                        },
                        onSelect: { entry in
                            detailAchievementId = entry.id
                        }
                    )
                    RecordsPanel(stats: stats)
                    planSection
                    notificationsSection
                    subscriptionSection
                    accountSection
                    aboutSection
                    Color.clear.frame(height: 40)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 140)
            }
        }
        .task {
            await settings.refresh()
            await reloadProfile()
            await reloadAchievements()
            blockedAppCount = LockModeService.shared.getSelectedAppCount()
        }
        .onReceive(NotificationCenter.default.publisher(for: .achievementsUnlocked)) { note in
            // Optimistically merge the newly-unlocked ids into our local set
            // so the badges flip to "earned" the instant the unlock toast
            // appears — no need to wait for the next server fetch.
            if let ids = note.userInfo?["ids"] as? [String] {
                earnedAchievements.formUnion(ids)
            }
        }
        .onAppear {
            // Refresh permission status when the user returns from OS Settings.
            Task { await settings.refresh() }
            blockedAppCount = LockModeService.shared.getSelectedAppCount()
        }
        // Sheets (Settings flows)
        .sheet(item: $sheet) { which in
            sheetView(for: which)
                .presentationDetents([.medium, .large])
                .presentationBackground(SystemTokens.panelBg)
        }
        // Sign-in / sign-up / edit-profile fullscreen navigation
        .fullScreenCover(isPresented: $showEditProfile) {
            EditProfileScreen(
                source: .profile,
                onClose: { showEditProfile = false },
                onSaved: {
                    showEditProfile = false
                    Task { await reloadProfile() }
                }
            )
            .environment(auth)
        }
        .fullScreenCover(isPresented: $showSignIn) {
            SignInScreen(
                goToSignUp: {
                    // SwiftUI can't present a new fullScreenCover while
                    // another is still dismissing — defer the swap until
                    // the dismissal animation has completed.
                    showSignIn = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        showSignUp = true
                    }
                },
                continueAsGuest: { showSignIn = false },
                onSignedIn: { showSignIn = false }
            )
            .environment(auth)
        }
        .fullScreenCover(isPresented: $showSignUp) {
            SignUpScreen(
                goToSignIn: {
                    showSignUp = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        showSignIn = true
                    }
                },
                continueAsGuest: { showSignUp = false },
                onSignedUp: {
                    showSignUp = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        showEditProfile = true
                    }
                }
            )
            .environment(auth)
        }
        .fullScreenCover(isPresented: $showPaywallOffer) {
            PaywallOfferScreen()
                .environment(subscription)
        }
        .fullScreenCover(item: Binding<AchievementDefinition?>(
            get: { detailAchievementId.flatMap { AchievementCatalog.byId[$0] } },
            set: { if $0 == nil { detailAchievementId = nil } }
        )) { def in
            AchievementDetailSheet(
                definition: def,
                earned: earnedAchievements.contains(def.id),
                onClose: { detailAchievementId = nil }
            )
        }
        // Confirmation alerts
        .alert("Sign Out?", isPresented: $showSignOutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                Task { await runSignOut() }
            }
        } message: {
            Text("You can sign back in anytime.")
        }
        .alert("Purchases restored", isPresented: $showRestoreAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(restoreMessage)
        }
        .alert("Enable Screen Time Access", isPresented: $showFamilyControlsDeniedAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
        } message: {
            Text("LockedIn needs Screen Time access to block apps. Open Settings → Screen Time and allow access for LockedIn, then try again.")
        }
    }

    // MARK: - Top panels

    private var playerPanel: some View {
        HUDPanel(headerLabel: "PLAYER") { EmptyView() }
    }

    private var identityPanel: some View {
        HUDPanel(headerLabel: "IDENTITY") {
            Button(action: profileCardTapped) {
                HStack(spacing: 12) {
                    avatarView
                    VStack(alignment: .leading, spacing: 2) {
                        Text(isGuest ? "Guest Account" : (settings.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? settings.displayName! : "No display name"))
                            .appText(TypographyPreset(family: .headingSemiBold, size: 17))
                            .foregroundColor(AppColors.textPrimary)
                            .lineLimit(1)
                        Text(isGuest ? "Sign up to save your progress" : (auth.user?.email ?? ""))
                            .appText(TypographyPreset(family: .body, size: 13))
                            .foregroundColor(AppColors.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(isGuest ? AppColors.accent : AppColors.textMuted)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(PressOpacityButtonStyle())
        }
    }

    @ViewBuilder
    private var avatarView: some View {
        if isGuest {
            avatarPlaceholder(systemName: "person")
        } else if let url = settings.avatarURL {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                avatarPlaceholder(systemName: "person.fill")
            }
            .frame(width: 56, height: 56)
            .clipShape(Circle())
        } else {
            avatarPlaceholder(systemName: "person.fill")
        }
    }

    private func avatarPlaceholder(systemName: String) -> some View {
        ZStack {
            Circle().fill(AppColors.surface)
            Image(systemName: systemName)
                .font(.system(size: 24))
                .foregroundColor(AppColors.textMuted)
        }
        .frame(width: 56, height: 56)
    }

    // MARK: - Sections

    private var planSection: some View {
        SettingsSection("Your plan") {
            SettingsRow(
                icon: "timer",
                label: "Daily commitment",
                value: "\(settings.dailyMinutes) min",
                onPress: { sheet = .dailyCommitment }
            )
            SettingsRow(
                icon: "flag",
                label: "Primary goal",
                value: truncate(settings.primaryGoal, length: 22),
                onPress: { sheet = .goalPicker }
            )
            SettingsRow(
                icon: "brain.head.profile",
                label: "Focus areas",
                value: "\(settings.weaknesses.count) selected",
                onPress: { sheet = .weaknessPicker }
            )
            SettingsRow(
                icon: "nosign",
                label: "Blocked apps",
                value: loadingAppPicker
                    ? "Loading…"
                    : (blockedAppCount > 0
                        ? "\(blockedAppCount) app\(blockedAppCount == 1 ? "" : "s")"
                        : "None"),
                disabled: loadingAppPicker,
                onPress: { presentBlockedAppPicker() }
            )
        }
    }

    private var notificationsSection: some View {
        let masterBinding = Binding<Bool>(
            get: { settings.pushMasterOn },
            set: { newValue in Task { await settings.setPushMasterEnabled(newValue) } }
        )
        let streakBinding = Binding<Bool>(
            get: { settings.streakAlertsOn },
            set: { newValue in Task { await settings.setStreakAlertsEnabled(newValue) } }
        )
        let guildBinding = Binding<Bool>(
            get: { settings.guildNotifsOn },
            set: { newValue in Task { await settings.setGuildNotifsEnabled(newValue) } }
        )

        return SettingsSection("Notifications") {
            SettingsRow(
                icon: "bell",
                label: "Push notifications",
                toggle: masterBinding,
                toggleStatus: settings.osDenied ? "Denied" : nil,
                toggleStatusColor: settings.osDenied ? AppColors.danger : nil
            )
            SettingsRow(
                icon: "alarm",
                label: "Daily reminder time",
                value: settings.reminderLabel,
                disabled: !settings.pushMasterOn,
                onPress: { sheet = .reminderTime }
            )
            SettingsRow(
                icon: "flame",
                label: "Streak protection alerts",
                toggle: streakBinding,
                disabled: !settings.pushMasterOn
            )
            if settings.hasGuild {
                SettingsRow(
                    icon: "person.3.fill",
                    label: "Guild notifications",
                    toggle: guildBinding,
                    disabled: !settings.pushMasterOn
                )
            }
        }
    }

    private var subscriptionSection: some View {
        SettingsSection("Subscription") {
            if subscription.isSubscribed {
                SettingsRow(
                    icon: "checkmark.seal.fill",
                    iconColor: AppColors.success,
                    label: "Locked In Pro",
                    value: "Active",
                    valueColor: AppColors.success,
                    showChevron: false
                )
                SettingsRow(
                    icon: "creditcard",
                    label: "Manage subscription",
                    onPress: { UIApplication.shared.open(SettingsConstants.manageSubscriptionURL) }
                )
                SettingsRow(
                    icon: "arrow.clockwise",
                    label: "Restore purchases",
                    onPress: { Task { await runRestore() } }
                )
            } else {
                SettingsRow(
                    icon: "star.fill",
                    iconColor: AppColors.warning,
                    label: "Upgrade to Pro",
                    onPress: { showPaywallOffer = true }
                )
                SettingsRow(
                    icon: "arrow.clockwise",
                    label: "Restore purchases",
                    onPress: { Task { await runRestore() } }
                )
            }
        }
    }

    private var accountSection: some View {
        SettingsSection("Account") {
            if !isGuest {
                if hasEmailIdentity {
                    SettingsRow(
                        icon: "lock",
                        label: "Change password",
                        onPress: { sheet = .changePassword }
                    )
                }
                SettingsRow(
                    icon: "rectangle.portrait.and.arrow.right",
                    label: "Sign out",
                    onPress: { showSignOutConfirm = true }
                )
                SettingsRow(
                    icon: "trash",
                    iconColor: AppColors.danger,
                    label: "Delete account",
                    onPress: { sheet = .deleteAccount }
                )
            } else {
                SettingsRow(
                    icon: "person.crop.circle.badge.plus",
                    iconColor: AppColors.accent,
                    label: "Create account",
                    onPress: { showSignUp = true }
                )
                SettingsRow(
                    icon: "arrow.right.circle",
                    label: "Sign in to existing account",
                    onPress: { showSignIn = true }
                )
                SettingsRow(
                    icon: "trash",
                    iconColor: AppColors.danger,
                    label: "Reset all data",
                    onPress: { sheet = .resetData }
                )
            }
        }
    }

    private var aboutSection: some View {
        SettingsSection("About") {
            SettingsRow(
                icon: "bubble.left.and.bubble.right",
                label: "Send feedback",
                onPress: { sheet = .feedback }
            )
            SettingsRow(
                icon: "star",
                label: "Rate Locked In",
                onPress: { presentReviewPrompt() }
            )
            SettingsRow(
                icon: "square.and.arrow.up",
                label: "Share with a friend",
                onPress: { presentShareSheet() }
            )
            SettingsRow(
                icon: "hand.raised",
                label: "Privacy policy",
                onPress: { UIApplication.shared.open(SettingsConstants.privacyURL) }
            )
            SettingsRow(
                icon: "doc.text",
                label: "Terms of service",
                onPress: { UIApplication.shared.open(SettingsConstants.termsURL) }
            )
            SettingsRow(
                icon: "info.circle",
                label: "Version",
                value: appVersion,
                showChevron: false
            )
        }
    }

    // MARK: - Derived

    private var isGuest: Bool {
        !auth.isAuthenticated
    }

    /// `true` when the current user has an "email" identity provider on the
    /// Supabase user. Mirrors RN `hasEmailIdentity(user)`.
    private var hasEmailIdentity: Bool {
        guard let user = auth.user, !user.resolvedIsAnonymous else { return false }
        return user.identities?.contains(where: { $0.provider == "email" }) ?? false
    }

    private var appVersion: String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0.0"
    }

    private func truncate(_ s: String, length: Int) -> String {
        guard s.count > length else { return s }
        return String(s.prefix(length - 1)) + "…"
    }

    // MARK: - Sheet routing

    private enum SettingsSheet: String, Identifiable {
        case dailyCommitment
        case goalPicker
        case weaknessPicker
        case reminderTime
        case changePassword
        case deleteAccount
        case resetData
        case feedback

        var id: String { rawValue }
    }

    @ViewBuilder
    private func sheetView(for which: SettingsSheet) -> some View {
        switch which {
        case .dailyCommitment:
            DailyCommitmentSheet(current: settings.dailyMinutes) { minutes in
                settings.setDailyCommitment(minutes)
            }
        case .goalPicker:
            GoalPickerSheet(current: settings.primaryGoal) { goal in
                settings.setPrimaryGoal(goal)
                // Notify the Missions feature to regenerate today's set when
                // the goal changes.
                NotificationCenter.default.post(
                    name: .lockedInRegenerateMissions,
                    object: nil
                )
            }
        case .weaknessPicker:
            WeaknessPickerSheet(current: settings.weaknesses) { list in
                settings.setWeaknesses(list)
                NotificationCenter.default.post(
                    name: .lockedInRegenerateMissions,
                    object: nil
                )
            }
        case .reminderTime:
            ReminderTimeSheet().environment(settings)
        case .changePassword:
            ChangePasswordSheet(email: auth.user?.email ?? "")
        case .deleteAccount:
            DeleteAccountSheet(onDeleted: { Task { await afterDeleteAccount() } })
                .environment(auth)
        case .resetData:
            ResetDataSheet(onConfirm: { await resetDataConfirm() })
        case .feedback:
            FeedbackSheet(userEmail: auth.user?.email)
        }
    }

    // MARK: - Actions

    private func profileCardTapped() {
        if isGuest {
            showSignUp = true
        } else {
            showEditProfile = true
        }
    }

    private func runSignOut() async {
        let result = await auth.signOut()
        if result.error == nil {
            // Fan out FULL_RESET to every feature state object so the cached
            // session / streak / missions / guild state is wiped.
            LogoutCleanupBus.shared.post(.logout)
        }
    }

    private func runRestore() async {
        guard !restoring else { return }
        restoring = true
        defer { restoring = false }
        let ok = await subscription.restorePurchases()
        restoreMessage = ok ? "Your purchases were restored." : "No purchases found to restore."
        showRestoreAlert = true
    }

    private func presentBlockedAppPicker() {
        // If Family Controls was previously denied, iOS will not re-show the
        // system prompt on `requestAuthorization` — surface our own alert
        // that deep-links to Settings so the user can re-enable it.
        if LockModeService.shared.currentAuthorizationStatus == .denied {
            showFamilyControlsDeniedAlert = true
            return
        }
        loadingAppPicker = true
        Task { @MainActor in
            // `showAppPicker` will request authorization first if status is
            // `.notDetermined` (triggering the system Family Controls
            // prompt), then present `FamilyActivityPicker`. Returns 0 if
            // the user denied authorization OR if the request silently
            // failed (e.g. missing entitlement, simulator).
            _ = await LockModeService.shared.showAppPicker()
            blockedAppCount = LockModeService.shared.getSelectedAppCount()
            loadingAppPicker = false
            // Any non-approved state after the call means the picker didn't
            // open: surface the alert so the row never appears to be a no-op.
            // Covers both `.denied` (user said no) and `.notDetermined` (the
            // system prompt didn't actually appear).
            if LockModeService.shared.currentAuthorizationStatus != .approved {
                showFamilyControlsDeniedAlert = true
            }
        }
    }

    private func presentReviewPrompt() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })
        else {
            UIApplication.shared.open(SettingsConstants.appStoreReviewURL())
            return
        }
        SKStoreReviewController.requestReview(in: scene)
    }

    private func presentShareSheet() {
        let message = SettingsConstants.shareMessage()
        let activity = UIActivityViewController(activityItems: [message], applicationActivities: nil)
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let root = scene.keyWindow?.rootViewController
        else { return }
        root.present(activity, animated: true)
    }

    private func afterDeleteAccount() async {
        // The RPC already invalidated the session. Fan out FULL_RESET to
        // every feature state object via the shared cleanup bus.
        _ = await auth.signOut()
        LogoutCleanupBus.shared.post(.accountDeleted)
    }

    private func resetDataConfirm() async {
        // Already wiped by ResetDataSheet; sign out + post cleanup.
        _ = await auth.signOut()
        LogoutCleanupBus.shared.post(.logout)
    }

    // MARK: - Profile load

    private func reloadProfile() async {
        guard auth.isAuthenticated, let uid = auth.user?.id.uuidString else {
            settings.reloadProfile(displayName: nil, avatarURL: nil)
            stats = nil
            return
        }
        let client = LockedInSupabase.shared.client
        struct Row: Decodable { let display_name: String?; let avatar_url: String? }
        do {
            let row: Row? = try await client
                .from("profiles")
                .select("display_name, avatar_url")
                .eq("id", value: uid)
                .single()
                .execute()
                .value
            let url = row?.avatar_url.flatMap(URL.init(string:))
            settings.reloadProfile(displayName: row?.display_name, avatarURL: url)
        } catch {
            #if DEBUG
            print("[ProfileTabScreen] reloadProfile failed:", error)
            #endif
        }
        // Pull `user_stats` so the letter-tier UI has real counter values.
        // Falls back to baseline (all F-) on failure — `SystemStatsCard`
        // handles `stats == nil` gracefully.
        do {
            if let row = try await HomeService.shared.refreshStats(userId: uid) {
                stats = UserStatsLite(from: row)
            }
        } catch {
            #if DEBUG
            print("[ProfileTabScreen] refreshStats failed:", error)
            #endif
        }
    }

    /// Pull the user's earned achievement ids from `user_achievements`.
    /// Run alongside `reloadProfile()` and re-run on focus so badges stay
    /// in sync if an unlock fired on another device.
    private func reloadAchievements() async {
        guard auth.isAuthenticated else {
            earnedAchievements = []
            return
        }
        earnedAchievements = await AchievementService.fetchEarnedIds()
    }
}

// MARK: - UIWindowScene helper

private extension UIWindowScene {
    var keyWindow: UIWindow? {
        windows.first(where: \.isKeyWindow) ?? windows.first
    }
}

// MARK: - Coordinator placeholder

/// Drop-in placeholder presented in `fullScreenCover` until the parent
/// navigator wires the real destination. Removed once the coordinator (Phase
/// 2) replaces these flags with `MainStack` route bindings.
private struct CoordinatorTODOView: View {
    let title: String
    let message: String
    let onClose: () -> Void

    var body: some View {
        ZStack {
            ScreenGradient()
            VStack(spacing: 12) {
                Text(title)
                    .appText(Typography.heading)
                    .foregroundColor(AppColors.textPrimary)
                Text(message)
                    .appText(Typography.body)
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Button("Close", action: onClose)
                    .foregroundColor(AppColors.accent)
                    .padding(.top, 12)
            }
        }
    }
}
