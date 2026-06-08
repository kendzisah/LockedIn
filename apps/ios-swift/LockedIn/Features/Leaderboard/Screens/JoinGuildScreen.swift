import SwiftUI
import DesignKit

/// JoinGuildScreen — 6-character invite code entry with shake-on-error
/// animation and success banner.
///
/// **Route name:** `JoinGuild` (no params).
///
/// Ported from `apps/mobile/src/features/leaderboard/screens/JoinGuildScreen.tsx`.
///
/// Allowed chars: `A-Z2-9` (server's `generate_invite_code()` skips
/// `0, O, I, L, 1` — see `supabase/migrations/20260403045935`).
///
/// Input pattern: ONE hidden `TextField` with `.textContentType(.oneTimeCode)`
/// drives the keyboard; six visible `cellDisplay` rectangles render the
/// characters as the user types. The previous "six TextFields, each tagged
/// `.oneTimeCode`, each with @FocusState focus-juggling" pattern froze the
/// main thread on a real device — Apple's autofill subsystem only expects
/// one OTP field, and the focus cascade on every keystroke compounded the
/// hang. The single-field pattern is the canonical iOS OTP idiom and
/// behaves cleanly.
public struct JoinGuildScreen: View {
    @Bindable var state: GuildState

    let onBack: () -> Void
    let onJoined: (_ guildId: String) -> Void

    public init(
        state: GuildState,
        onBack: @escaping () -> Void,
        onJoined: @escaping (String) -> Void
    ) {
        self.state = state
        self.onBack = onBack
        self.onJoined = onJoined
    }

    private static let codeLength = 6

    /// Single source of truth — the full code typed so far. Display cells
    /// render `chars[i]` against this string's `i`-th character (or empty
    /// when `i >= code.count`).
    @State private var code: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successMessage: String? = nil
    @State private var shakeOffset: CGFloat = 0
    @FocusState private var keyboardFocused: Bool

    private var isFull: Bool { code.count == Self.codeLength }
    /// Regex applied per-character on input — matches the server's
    /// `generate_invite_code()` alphabet (skips `0/O/I/L/1`).
    private static let allowedCharSet: Set<Character> = Set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")

    public var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                VStack(spacing: 0) {
                    Spacer()

                    Text("Enter the 6-character invite code from your friend.")
                        .font(.custom(FontFamily.body.rawValue, size: 14))
                        .foregroundColor(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                        .padding(.bottom, 28)

                    cellRow
                        .padding(.bottom, 32)

                    joinButton

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.custom(FontFamily.body.rawValue, size: 13))
                            .foregroundColor(AppColors.danger)
                            .multilineTextAlignment(.center)
                            .padding(.top, 16)
                    }

                    if let successMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 18))
                                .foregroundColor(AppColors.success)
                            Text(successMessage)
                                .font(.custom(FontFamily.headingSemiBold.rawValue, size: 14))
                                .foregroundColor(AppColors.success)
                        }
                        .padding(.vertical, 10)
                        .padding(.horizontal, 16)
                        .background(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color(.sRGB, red: 0/255, green: 214/255, blue: 143/255, opacity: 0.15), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.top, 16)
                    }

                    Spacer()
                    Spacer()
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 80)
            }

            // Hidden keyboard input — invisible but interactive. Tapping
            // any visible cell calls `keyboardFocused = true` to surface
            // the keyboard.
            hiddenInputField
        }
        .onAppear {
            // Defer focus by one runloop tick so the focus change
            // doesn't fight the push transition animation.
            DispatchQueue.main.async {
                keyboardFocused = true
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(AppColors.textPrimary)
                    .padding(10)
            }
            .buttonStyle(PressOpacityButtonStyle())

            Spacer()

            Text("Join a Guild")
                .font(.custom(FontFamily.heading.rawValue, size: 18))
                .foregroundColor(AppColors.textPrimary)

            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    // MARK: - Cells

    private var cellRow: some View {
        HStack(spacing: 10) {
            ForEach(0..<Self.codeLength, id: \.self) { idx in
                cellDisplay(idx: idx)
            }
        }
        .offset(x: shakeOffset)
        .contentShape(Rectangle())
        .onTapGesture { keyboardFocused = true }
    }

    @ViewBuilder
    private func cellDisplay(idx: Int) -> some View {
        let ch = character(at: idx)
        let filled = ch != nil
        // The "active" cell is the next empty slot. Visually highlighted
        // so the user always knows where the next keystroke lands.
        let active = (idx == code.count) && keyboardFocused
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    active
                        ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.06)
                        : Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.4)
                )
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    active
                        ? AppColors.primary
                        : (filled
                            ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3)
                            : Color.white.opacity(0.06)),
                    lineWidth: 1.5
                )

            if let ch {
                Text(String(ch))
                    .font(.custom(FontFamily.heading.rawValue, size: 22))
                    .foregroundColor(AppColors.textPrimary)
            }
        }
        .frame(width: 48, height: 56)
    }

    /// Character at a given cell index, or `nil` for the unfilled slots.
    private func character(at idx: Int) -> Character? {
        guard idx < code.count else { return nil }
        return code[code.index(code.startIndex, offsetBy: idx)]
    }

    // MARK: - Hidden input

    /// Invisible but focusable TextField that drives the keyboard.
    /// Sized 1×1 with near-zero opacity so it's reachable by VoiceOver
    /// and tap-through but invisible. `.textContentType(.oneTimeCode)`
    /// here (and only here) gives us proper SMS-code autofill.
    private var hiddenInputField: some View {
        TextField("", text: Binding(
            get: { code },
            set: { newValue in handleInputChange(newValue) }
        ))
        .keyboardType(.asciiCapable)
        .textContentType(.oneTimeCode)
        .textInputAutocapitalization(.characters)
        .autocorrectionDisabled(true)
        .focused($keyboardFocused)
        .onSubmit { Task { await handleJoin() } }
        .frame(width: 1, height: 1)
        .opacity(0.001)
        .accessibilityLabel("Invite code")
    }

    private func handleInputChange(_ raw: String) {
        // Filter to the server's allowed alphabet + uppercase + cap at 6.
        let filtered = raw
            .uppercased()
            .filter { Self.allowedCharSet.contains($0) }
            .prefix(Self.codeLength)
        let next = String(filtered)
        if next != code {
            code = next
            errorMessage = nil
        }
    }

    // MARK: - Join button

    private var joinButton: some View {
        Button(action: { Task { await handleJoin() } }) {
            ZStack {
                if isLoading {
                    ProgressView()
                        .tint(AppColors.textPrimary)
                } else {
                    Text("Join Guild")
                        .font(.custom(FontFamily.headingSemiBold.rawValue, size: 16))
                        .foregroundColor(AppColors.primary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.12))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(isFull && !isLoading ? 1 : 0.4)
        }
        .buttonStyle(PressOpacityButtonStyle())
        .disabled(!isFull || isLoading)
    }

    // MARK: - Shake / join

    private func triggerShake() {
        let baseAnim = Animation.linear(duration: 0.05)
        withAnimation(baseAnim) { shakeOffset = 10 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            withAnimation(baseAnim) { shakeOffset = -10 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.10) {
            withAnimation(baseAnim) { shakeOffset = 8 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(baseAnim) { shakeOffset = -8 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.20) {
            withAnimation(baseAnim) { shakeOffset = 0 }
        }
    }

    private func handleJoin() async {
        guard isFull, !isLoading else { return }
        isLoading = true
        errorMessage = nil

        let result = await state.joinGuild(code: code)
        isLoading = false

        if let result {
            AnalyticsService.shared.track("Guild Joined", properties: [
                "guild_id": result.guild_id,
                "guild_name": result.guild_name,
                "method": "invite_code",
            ])
            XPService.award(.guildJoin)
            successMessage = "Joined \(result.guild_name)!"
            // 1.2s delay before navigating, matching RN.
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            onJoined(result.guild_id)
        } else {
            triggerShake()
            errorMessage = "Invalid invite code, guild is full, or you've reached the 5 guild limit."
        }
    }
}
