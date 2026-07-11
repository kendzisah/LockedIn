//
//  HUDPaywallScreen.swift
//  LockedIn
//
//  Fully custom, RevenueCat-SDK-backed paywall in the app's HUD aesthetic.
//  Replaces the prebuilt `RevenueCatUI.PaywallView` in BOTH contexts
//  (onboarding + Lock-In gate). Hard gate: no dismiss unless the user
//  subscribes or restores.
//
//  - Dynamically renders however many packages the current Offering exposes
//    (1–3) via `PaywallModel` / `PaywallPricing`.
//  - Surfaces introductory offers (free trial etc.) only to eligible accounts.
//  - Promo section launches Apple's native offer-code redemption sheet.
//  - Currency-safe pricing (all strings come localized from StoreKit).
//

import SwiftUI
import DesignKit

public struct HUDPaywallScreen: View {

    public enum Context {
        case onboarding
        case lockIn
        /// Shown at the root on relaunch when a non-subscriber (lapsed, or a
        /// legacy free user) has already completed onboarding.
        case relaunch

        var source: String {
            switch self {
            case .onboarding: return "onboarding"
            case .lockIn:     return "lock_in"
            case .relaunch:   return "app_relaunch"
            }
        }
        var headline: String {
            switch self {
            case .onboarding: return "Invest in yourself,\nand reset your life in 66 days."
            case .lockIn:     return "Unlock unlimited\nfocus."
            case .relaunch:   return "Your system is ready.\nUnlock it to continue."
            }
        }
        var subhead: String {
            switch self {
            case .onboarding: return "Your character is built. Now start the game."
            case .lockIn:     return "You're one lock-in away from deep work."
            case .relaunch:   return "An active membership keeps your sessions, stats, and streak alive."
            }
        }
        var ctaDefault: String {
            switch self {
            case .onboarding: return "Start My Journey"
            case .lockIn:     return "Unlock Lock-In"
            case .relaunch:   return "Continue"
            }
        }
    }

    let context: Context
    /// Hard gate = false. Kept as a knob so the Lock-In variant can later allow
    /// backing out without trapping a lapsed subscriber (see plan caveat).
    let isDismissable: Bool
    /// Called once the user becomes entitled (purchase / restore / promo).
    let onSubscribed: () -> Void
    /// Only invoked when `isDismissable` is true.
    let onDismiss: (() -> Void)?

    public init(
        context: Context,
        isDismissable: Bool = false,
        onSubscribed: @escaping () -> Void,
        onDismiss: (() -> Void)? = nil
    ) {
        self.context = context
        self.isDismissable = isDismissable
        self.onSubscribed = onSubscribed
        self.onDismiss = onDismiss
    }

    @Environment(SubscriptionState.self) private var subscription
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    @State private var model = PaywallModel()
    @State private var screenOpacity: Double = 0
    @State private var panelOffset: CGFloat = 40
    @State private var panelOpacity: Double = 0
    @State private var showPromo = false
    @State private var showWinback = false
    @State private var didSucceed = false
    @State private var shownFired = false

    /// Persisted so the one-time winback downsell is shown at most once per install.
    private static let winbackShownKey = "@lockedin/winback_offer_shown"

    // Marketing social proof (edit freely — plain copy, no runtime source).
    private static let socialProof: [(String, String)] = [
        ("30K+", "5-Star Reviews"),
        ("Top 30", "Productivity Apps"),
    ]

    public var body: some View {
        ZStack {
            ScreenGradient()
            GlowOrb(preset: .blue, size: 360, blurRadius: 90)
                .opacity(0.85).offset(x: -40, y: -280)
            GlowOrb(preset: .cyan, size: 300, blurRadius: 80)
                .opacity(0.5).offset(x: 80, y: 240)

            VStack(spacing: 0) {
                hero.opacity(screenOpacity)
                planPanel
                    .opacity(panelOpacity)
                    .offset(y: panelOffset)
            }
        }
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled(!isDismissable)
        .task {
            // Already entitled when the gate appears (restored on a fresh
            // install, subscribed on another device, or a cold-start race).
            // `.onChange(isSubscribed)` only fires on a transition, so without
            // this an already-subscribed user would be trapped behind the hard
            // gate forever. Route out silently (no "Subscription Started").
            if subscription.isSubscribed {
                handleSuccess(track: false)
                return
            }
            if !shownFired {
                shownFired = true
                AnalyticsService.shared.track("Paywall Shown", properties: ["source": context.source])
            }
            // Reveal the UI immediately (the hero is static; the plan panel shows
            // its own loading state). Doing this BEFORE the await guarantees the
            // paywall never renders blank if offerings load slowly or hang.
            animateIn()
            await model.load(state: subscription)
        }
        // Promo redemption (or any external entitlement grant) arrives via the
        // SubscriptionState listener — treat it as success.
        .onChange(of: subscription.isSubscribed) { _, subscribed in
            // Any path to entitlement (purchase, restore, promo, or an external
            // grant while the winback sheet is up) routes out. Dismiss the
            // winback first so it never orphans; `handleSuccess` is idempotent,
            // so the winback's own onClaimed firing too is harmless.
            if subscribed {
                showWinback = false
                handleSuccess()
            }
        }
        // Auto-recover the hard gate: if plans failed to load (offline first
        // run), retry when the user returns to the app rather than stranding
        // them on a manual Retry — the gate stays hard, it just self-heals once
        // connectivity is back.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, !didSucceed,
               model.loadState == .failed || model.loadState == .empty {
                Task { await model.load(state: subscription) }
            }
        }
        .sheet(isPresented: $showPromo) {
            PromoCodeSheet(onRedeem: { model.redeemPromo(state: subscription) })
                .presentationDetents([.height(280)])
                .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $showWinback, onDismiss: {
            // Fires on ANY dismissal (swipe OR "No thanks"). Count it as a
            // decline unless the user actually claimed — `handleSuccess` sets
            // `didSucceed` before the dismissal animation completes.
            if !didSucceed {
                AnalyticsService.shared.track("Winback Declined", properties: ["source": context.source])
            }
        }) {
            // The winback is a downsell, NOT the hard gate — declining it just
            // returns to the (still hard-gated) primary paywall. So it must be
            // freely dismissable: full-height sheet, visible grab handle, and
            // swipe enabled, so the user is never trapped on it.
            WinbackSheet(
                plans: model.winbackPlans,
                discountPercent: model.winbackDiscountPercent,
                onClaim: { plan in
                    await model.purchase(package: plan.package, state: subscription) == .subscribed
                },
                onClaimed: {
                    showWinback = false
                    handleSuccess()
                },
                onDecline: { showWinback = false }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Hero (scrollable)

    private var hero: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                if isDismissable, let onDismiss {
                    HStack {
                        Spacer()
                        Button(action: onDismiss) {
                            Image(systemName: "xmark")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(SystemTokens.textMuted)
                                .padding(8)
                        }
                        .buttonStyle(PressOpacityButtonStyle())
                    }
                }

                Text("LOCKED IN")
                    .font(.custom(FontFamily.display.rawValue, size: 20))
                    .tracking(4)
                    .foregroundColor(SystemTokens.textPrimary)
                    .padding(.top, isDismissable ? 4 : 24)

                Text(context.headline)
                    .font(.custom(FontFamily.headingBold.rawValue, size: 28))
                    .tracking(-0.4)
                    .foregroundColor(SystemTokens.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 18)

                Text(context.subhead)
                    .font(.custom(FontFamily.body.rawValue, size: 15))
                    .foregroundColor(SystemTokens.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 10)

                laurels.padding(.top, 22)

                featureList.padding(.top, 24)

                outcomesSection.padding(.top, 34)

                trajectorySection.padding(.top, 34)

                habitsSection.padding(.top, 34)

                closingLine.padding(.top, 34).padding(.bottom, 8)

                Spacer(minLength: 12)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: - Hero sections (scroll-revealed)

    /// Benefit-led outcomes — "what actually changes" (distinct from the
    /// feature list, which is "what you get").
    private var outcomesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            sectionLabel("WHAT CHANGES IN 66 DAYS")
            ForEach(Self.outcomes, id: \.title) { o in
                HStack(alignment: .top, spacing: 14) {
                    iconChip(o.icon, tint: o.tint)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(o.title)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                            .foregroundColor(SystemTokens.textPrimary)
                        Text(o.subtitle)
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textSecondary)
                            .lineSpacing(3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    /// A simple "momentum compounds" graphic: three growing bars for the first
    /// week, first month, and day 66. Motivational, not a specific claim.
    private var trajectorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("YOUR MOMENTUM")
            VStack(spacing: 12) {
                ForEach(Self.trajectory, id: \.label) { t in
                    HStack(spacing: 12) {
                        Text(t.label)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 12))
                            .tracking(0.4)
                            .foregroundColor(SystemTokens.textSecondary)
                            .frame(width: 58, alignment: .leading)
                        StatBar(progress: t.progress, color: t.color, height: 8)
                        Text(t.note)
                            .font(.custom(FontFamily.body.rawValue, size: 11))
                            .foregroundColor(SystemTokens.textMuted)
                            .frame(width: 84, alignment: .trailing)
                    }
                }
            }
            .padding(14)
            .background(SystemTokens.panelBg)
            .overlay(Rectangle().stroke(SystemTokens.panelBorder, lineWidth: 1))
        }
    }

    /// Example habits, as tappable-looking category chips (matches the app's
    /// habit language). Shows breadth without over-claiming.
    private var habitsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionLabel("HABITS THAT STICK")
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 104), spacing: 8)],
                alignment: .leading,
                spacing: 8
            ) {
                ForEach(Self.habits, id: \.name) { h in
                    HStack(spacing: 7) {
                        Circle().fill(h.color).frame(width: 6, height: 6)
                        Text(h.name)
                            .font(.custom(FontFamily.headingSemiBold.rawValue, size: 13))
                            .foregroundColor(SystemTokens.textPrimary)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
                    .background(h.color.opacity(0.08))
                    .overlay(Rectangle().stroke(h.color.opacity(0.25), lineWidth: 1))
                }
            }
        }
    }

    private var closingLine: some View {
        VStack(spacing: 6) {
            Text("66 days from today,\nyou won't recognize the old you.")
                .font(.custom(FontFamily.headingBold.rawValue, size: 20))
                .tracking(-0.2)
                .foregroundColor(SystemTokens.textPrimary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            Text("The only question is whether you start today.")
                .font(.custom(FontFamily.body.rawValue, size: 13))
                .foregroundColor(SystemTokens.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text("// \(text)")
            .font(.custom(FontFamily.display.rawValue, size: 10))
            .tracking(2.4)
            .foregroundColor(SystemTokens.glowAccent)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func iconChip(_ systemName: String, tint: Color) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(tint.opacity(0.14))
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(tint)
        }
        .frame(width: 34, height: 34)
    }

    private var laurels: some View {
        HStack(spacing: 28) {
            ForEach(Self.socialProof, id: \.0) { stat in
                HStack(spacing: 6) {
                    Image(systemName: "laurel.leading")
                        .font(.system(size: 26))
                        .foregroundColor(SystemTokens.textMuted)
                    VStack(spacing: 2) {
                        Text(stat.0)
                            .font(.custom(FontFamily.headingBold.rawValue, size: 17))
                            .foregroundColor(SystemTokens.textPrimary)
                        Text(stat.1)
                            .font(.custom(FontFamily.body.rawValue, size: 10))
                            .foregroundColor(SystemTokens.textMuted)
                            .multilineTextAlignment(.center)
                    }
                    Image(systemName: "laurel.trailing")
                        .font(.system(size: 26))
                        .foregroundColor(SystemTokens.textMuted)
                }
            }
        }
    }

    private var featureList: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Self.features, id: \.label) { feat in
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(SystemTokens.cyan.opacity(0.12))
                        Image(systemName: feat.systemImage)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(SystemTokens.cyan)
                    }
                    .frame(width: 26, height: 26)
                    Text(feat.label)
                        .font(.custom(FontFamily.bodyMedium.rawValue, size: 14))
                        .foregroundColor(SystemTokens.textPrimary)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    // MARK: - Plan panel (pinned bottom)

    private var planPanel: some View {
        VStack(spacing: 12) {
            // `// CHOOSE YOUR PLAN` chrome header + optional sale badge.
            HStack {
                Text("// CHOOSE YOUR PLAN")
                    .font(.custom(FontFamily.display.rawValue, size: 10))
                    .tracking(2.4)
                    .foregroundColor(SystemTokens.glowAccent)
                Spacer()
                if let badge = saleBadge {
                    Text(badge)
                        .font(.custom(FontFamily.headingBold.rawValue, size: 10))
                        .tracking(0.6)
                        .foregroundColor(SystemTokens.cyan)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(SystemTokens.cyan.opacity(0.14))
                        .overlay(Rectangle().stroke(SystemTokens.cyan.opacity(0.4), lineWidth: 1))
                }
            }

            planContent

            if let error = model.errorMessage {
                Text(error)
                    .font(.custom(FontFamily.body.rawValue, size: 12))
                    .foregroundColor(SystemTokens.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .background(SystemTokens.panelBg.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) {
            LinearGradient(colors: [SystemTokens.panelBorder, .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 1)
        }
    }

    @ViewBuilder
    private var planContent: some View {
        switch model.loadState {
        case .loading:
            ProgressView()
                .tint(SystemTokens.glowAccent)
                .frame(maxWidth: .infinity, minHeight: 120)

        case .failed, .empty:
            VStack(spacing: 10) {
                Text(model.loadState == .failed
                     ? "Couldn't load plans. Check your connection."
                     : "Plans are unavailable right now.")
                    .font(.custom(FontFamily.body.rawValue, size: 13))
                    .foregroundColor(SystemTokens.textSecondary)
                    .multilineTextAlignment(.center)
                PrimaryButton("Retry") { Task { await model.load(state: subscription) } }
                restoreRow
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)

        case .ready:
            VStack(spacing: 8) {
                ForEach(model.plans) { plan in
                    PlanOptionRow(
                        plan: plan,
                        isSelected: plan.id == model.selectedID,
                        action: {
                            HapticsService.shared.selectionChanged()
                            model.selectedID = plan.id
                        }
                    )
                }
            }

            Text("No commitment, cancel anytime")
                .font(.custom(FontFamily.body.rawValue, size: 12))
                .foregroundColor(SystemTokens.textSecondary)
                .padding(.top, 2)

            ctaButton

            if let terms = model.selectedPlan?.billedTerms {
                Text(terms)
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.textMuted)
            }
            if let intro = model.selectedPlan?.intro {
                Text(intro.detail)
                    .font(.custom(FontFamily.body.rawValue, size: 11))
                    .foregroundColor(SystemTokens.textMuted)
            }

            HStack(spacing: 20) {
                footerLink("Restore") { restore() }
                Circle().fill(SystemTokens.textMuted.opacity(0.35)).frame(width: 3, height: 3)
                footerLink("Have a promo code?") {
                    AnalyticsService.shared.track("Paywall Promo Tapped", properties: ["source": context.source])
                    showPromo = true
                }
            }
            .padding(.top, 2)
        }
    }

    private var restoreRow: some View {
        footerLink("Restore purchase") { restore() }
    }

    private var ctaButton: some View {
        Button(action: purchase) {
            ZStack {
                LinearGradient(
                    colors: [AppColors.primary, AppColors.primary.opacity(0.85)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                if model.isPurchasing {
                    ProgressView().tint(.white)
                } else {
                    HStack(spacing: 8) {
                        Text(model.ctaTitle(default: context.ctaDefault).uppercased())
                            .font(.custom(FontFamily.display.rawValue, size: 13))
                            .tracking(1.3)
                            .foregroundColor(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            // HUD: sharp corners, hairline rim, corner brackets.
            .overlay(Rectangle().stroke(Color.white.opacity(0.22), lineWidth: 1))
            .overlay(
                HUDCornerBrackets(length: 12, thickness: 1.5, color: Color.white.opacity(0.85), pulses: false)
                    .padding(3)
            )
            .shadow(color: AppColors.primary.opacity(0.45), radius: 20, x: 0, y: 8)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(model.isPurchasing || model.selectedPlan == nil)
        .shineSweep(cornerRadius: 0, cycle: 3.6, translation: 1.5, peakAlpha: 0.18)
    }

    private func footerLink(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.custom(FontFamily.bodyMedium.rawValue, size: 12))
                .foregroundColor(SystemTokens.textSecondary)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(model.isPurchasing)
    }

    /// Marketing badge — ONLY the offering's explicit dashboard `badge`
    /// metadata (e.g. "Launch Offer"). We deliberately do NOT auto-generate a
    /// "% OFF" sale claim: implying a discount off a nonexistent regular price
    /// risks App Review rejection under the accurate-metadata rules. Real,
    /// factual value lives in the per-plan "SAVE X%" comparison badge instead.
    private var saleBadge: String? { model.offeringBadge }

    // MARK: - Actions

    private func purchase() {
        HapticsService.shared.medium()
        AnalyticsService.shared.track("Paywall CTA Tapped", properties: [
            "source": context.source,
            "product_id": model.selectedPlan?.productIdentifier ?? "",
            "plan": model.selectedPlan?.title ?? "",
        ])
        Task {
            switch await model.purchaseSelected(state: subscription) {
            case .subscribed: handleSuccess()
            case .cancelled: await maybePresentWinback()
            case .failed: break  // errorMessage is surfaced in the panel
            }
        }
    }

    /// One-time downsell: when the user backs out of the purchase on the
    /// ONBOARDING hard gate, offer the discounted "winback" offering — at most
    /// once per install, and only if such an offering exists.
    private func maybePresentWinback() async {
        guard context == .onboarding, !didSucceed, !showWinback else { return }
        guard !Defaults.bool(Self.winbackShownKey) else { return }
        guard await model.loadWinback(state: subscription) else { return }
        // Re-check after the await: a concurrent restore / promo grant could
        // have entitled the user (or routing could have started) while the
        // winback offering loaded. Don't burn the one-shot or show it then.
        guard !didSucceed, !subscription.isSubscribed, !showWinback else { return }
        Defaults.setBool(true, Self.winbackShownKey)
        AnalyticsService.shared.track("Winback Shown", properties: ["source": context.source])
        showWinback = true
    }

    private func restore() {
        AnalyticsService.shared.track("Paywall Restore Tapped", properties: ["source": context.source])
        Task {
            if await model.restore(state: subscription) { handleSuccess() }
        }
    }

    /// Route out of the paywall. `track` is false for the already-entitled
    /// pass-through so we don't fire a spurious "Subscription Started" or a
    /// celebration haptic for a user who didn't just purchase here.
    private func handleSuccess(track: Bool = true) {
        guard !didSucceed else { return }
        didSucceed = true
        if track {
            HapticsService.shared.success()
            AnalyticsService.shared.track("Subscription Started", properties: ["source": context.source])
        }
        withAnimation(.easeInOut(duration: 0.4)) { screenOpacity = 0; panelOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { onSubscribed() }
    }

    private func animateIn() {
        guard !reduceMotion else {
            screenOpacity = 1; panelOpacity = 1; panelOffset = 0
            return
        }
        withAnimation(.easeOut(duration: 0.5)) { screenOpacity = 1 }
        withAnimation(.interpolatingSpring(stiffness: 120, damping: 16).delay(0.25)) {
            panelOffset = 0; panelOpacity = 1
        }
    }

    // MARK: - Static

    private struct Feature { let systemImage: String; let label: String }
    private static let features: [Feature] = [
        Feature(systemImage: "lock",      label: "Unlimited focus sessions"),
        Feature(systemImage: "bolt",      label: "Daily personalized missions"),
        Feature(systemImage: "chart.bar", label: "Full OVR & stat tracking"),
        Feature(systemImage: "trophy",    label: "Rank progression & leaderboards"),
        Feature(systemImage: "shield",    label: "Streak recovery (1x/week)"),
    ]

    private struct Outcome { let icon: String; let tint: Color; let title: String; let subtitle: String }
    private static let outcomes: [Outcome] = [
        Outcome(icon: "hourglass.bottomhalf.filled", tint: SystemTokens.cyan,
                title: "Reclaim your time",
                subtitle: "Seal off the apps that steal your hours and get them back."),
        Outcome(icon: "scope", tint: SystemTokens.glowAccent,
                title: "Focus that actually holds",
                subtitle: "Lock-in sessions block distractions until you're done — no willpower required."),
        Outcome(icon: "chart.line.uptrend.xyaxis", tint: SystemTokens.green,
                title: "Proof you're changing",
                subtitle: "Every session raises your stats, rank, and streak. Watch the numbers climb."),
        Outcome(icon: "figure.mind.and.body", tint: SystemTokens.gold,
                title: "Become someone you respect",
                subtitle: "Show up daily for 66 days and discipline stops being a decision."),
    ]

    private struct Trajectory { let label: String; let progress: Double; let color: Color; let note: String }
    private static let trajectory: [Trajectory] = [
        Trajectory(label: "WEEK 1",   progress: 0.28, color: SystemTokens.glowAccent, note: "the spark"),
        Trajectory(label: "MONTH 1",  progress: 0.62, color: SystemTokens.cyan,       note: "the habit"),
        Trajectory(label: "DAY 66",   progress: 1.0,  color: SystemTokens.green,      note: "the identity"),
    ]

    private struct Habit { let name: String; let color: Color }
    private static let habits: [Habit] = [
        Habit(name: "Gym",        color: SystemTokens.green),
        Habit(name: "Deep Work",  color: SystemTokens.cyan),
        Habit(name: "Read",       color: SystemTokens.purple),
        Habit(name: "No Social",  color: SystemTokens.cyan),
        Habit(name: "Cold Shower", color: SystemTokens.green),
        Habit(name: "Journal",    color: SystemTokens.purple),
        Habit(name: "Study",      color: SystemTokens.cyan),
        Habit(name: "Meditate",   color: SystemTokens.purple),
    ]
}

