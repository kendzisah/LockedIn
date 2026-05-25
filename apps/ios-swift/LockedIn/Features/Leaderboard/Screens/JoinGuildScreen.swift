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

    @State private var chars: [String] = Array(repeating: "", count: 6)
    @State private var focusedIdx: Int = 0
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @State private var successMessage: String? = nil
    @State private var shakeOffset: CGFloat = 0
    @FocusState private var focusedField: Int?

    private var isFull: Bool { chars.allSatisfy { $0.count == 1 } }
    private static let validRegex = try! NSRegularExpression(pattern: "^[A-Z2-9]$")

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

                    HStack(spacing: 10) {
                        ForEach(0..<Self.codeLength, id: \.self) { idx in
                            charBox(idx: idx)
                        }
                    }
                    .offset(x: shakeOffset)
                    .padding(.bottom, 32)

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
        }
        .onAppear {
            focusedField = 0
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

    // MARK: - Char box

    @ViewBuilder
    private func charBox(idx: Int) -> some View {
        let filled = chars[idx].count > 0
        let focused = focusedField == idx
        ZStack {
            TextField(
                "",
                text: Binding(
                    get: { chars[idx] },
                    set: { handleChange(text: $0, idx: idx) }
                )
            )
            .multilineTextAlignment(.center)
            .font(.custom(FontFamily.heading.rawValue, size: 22))
            .foregroundColor(AppColors.textPrimary)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled(true)
            .keyboardType(.asciiCapable)
            .textContentType(.oneTimeCode)
            .focused($focusedField, equals: idx)
            .onSubmit { Task { await handleJoin() } }
        }
        .frame(width: 48, height: 56)
        .background(
            focused
                ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.06)
                : Color(.sRGB, red: 44/255, green: 52/255, blue: 64/255, opacity: 0.4)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    focused
                        ? AppColors.primary
                        : (filled
                            ? Color(.sRGB, red: 58/255, green: 102/255, blue: 255/255, opacity: 0.3)
                            : Color.white.opacity(0.06)),
                    lineWidth: 1.5
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    // MARK: - Char handling

    private func handleChange(text raw: String, idx: Int) {
        let upper = raw.uppercased()

        // Paste-full-code path.
        if upper.count >= Self.codeLength {
            let pasted = Array(upper.prefix(Self.codeLength)).map(String.init)
            if pasted.allSatisfy(Self.isValidChar) {
                chars = pasted
                errorMessage = nil
                focusedField = Self.codeLength - 1
                return
            }
        }

        let lastChar = String(upper.suffix(1))
        if !lastChar.isEmpty && !Self.isValidChar(lastChar) {
            // Invalid char — drop it.
            chars[idx] = ""
            return
        }

        chars[idx] = lastChar
        errorMessage = nil

        if !lastChar.isEmpty && idx < Self.codeLength - 1 {
            focusedField = idx + 1
        } else if lastChar.isEmpty && idx > 0 {
            // Backspace path: move focus back if the cell was already empty.
            focusedField = idx - 1
        }
    }

    private static func isValidChar(_ s: String) -> Bool {
        let range = NSRange(s.startIndex..<s.endIndex, in: s)
        return validRegex.firstMatch(in: s, range: range) != nil
    }

    // MARK: - Join

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

        let code = chars.joined()
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
