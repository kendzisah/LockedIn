import SwiftUI
import PhotosUI
import DesignKit
import Supabase

/// Edit Profile — display name + avatar setup.
///
/// Port of `apps/mobile/src/features/auth/screens/EditProfileScreen.tsx`.
///
/// Two routing modes:
/// - `.signup` — shown after sign-up. "Save" replaces the stack with the
///   tabs root; a "Skip for now" link is exposed.
/// - `.profile` — shown from Settings. "Save" pops the stack; no skip link;
///   a back chevron is shown in the header.
///
/// Supabase calls (must match RN 1:1):
/// - Loads `profiles.display_name, avatar_url` for the current user
///   (`SELECT … FROM profiles WHERE id = uid`).
/// - Uploads picked avatar to the `avatars` storage bucket at path
///   `{userId}/avatar.{ext}` with `upsert: true`, where `ext` is derived
///   from the asset's MIME type (`jpg`/`png`/`webp`/`heic`).
/// - Writes `display_name` and `avatar_url` back to `profiles`.
///
/// `onSaved` is wired in `MainNavigator` and `ProfileTabScreen` — both pop
/// the modal. The signup path also fires after the main stack already
/// pushed `editProfile`, so a pop returns to the tabs root.
public struct EditProfileScreen: View {
    public enum Source: String {
        case signup
        case profile
    }

    let source: Source
    let onClose: () -> Void
    let onSaved: () -> Void

    @Environment(AuthState.self) private var auth

    @State private var displayName: String = ""
    @State private var avatarURL: URL? = nil
    @State private var pickedImage: UIImage? = nil
    @State private var pickedMime: String? = nil
    @State private var pickedExt: String = "jpg"
    @State private var photoItem: PhotosPickerItem? = nil
    @State private var showPhotoMenu: Bool = false
    @State private var photoMenuPickerVisible: Bool = false
    @State private var uploading: Bool = false
    @State private var saving: Bool = false

    /// User explicitly tapped "Remove Photo". We have to distinguish this
    /// from "user didn't touch the avatar" so the save handler knows to
    /// send `avatar_url: nil` and actually clear the DB column — without
    /// this flag, the update body falls back to a name-only patch and the
    /// previous URL stays put.
    @State private var didRemoveAvatar: Bool = false
    @State private var alertTitle: String = ""
    @State private var alertMessage: String = ""
    @State private var showAlert: Bool = false

    private let maxNameLength: Int = 20

    public init(
        source: Source,
        onClose: @escaping () -> Void,
        onSaved: @escaping () -> Void
    ) {
        self.source = source
        self.onClose = onClose
        self.onSaved = onSaved
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            body_
            bottom
        }
        .background(AppColors.background.ignoresSafeArea())
        .task { await loadExistingProfile() }
        .onChange(of: photoItem) { _, newValue in
            Task { await handlePickerSelection(newValue) }
        }
        .confirmationDialog("Profile photo", isPresented: $showPhotoMenu, titleVisibility: .visible) {
            // PhotosPicker takes care of presenting the picker; iOS 17 lets
            // us trigger it via state. The "Take Photo" path would require a
            // UIImagePickerController wrapper — kept as a TODO since the
            // RN flow uses both library + camera.
            Button("Choose from Library") {
                photoMenuPickerVisible = true
            }
            if pickedImage != nil || avatarURL != nil {
                Button("Remove Photo", role: .destructive) {
                    pickedImage = nil
                    pickedMime = nil
                    avatarURL = nil
                    didRemoveAvatar = true
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(
            isPresented: $photoMenuPickerVisible,
            selection: $photoItem,
            matching: .images
        )
        .alert(alertTitle, isPresented: $showAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 0) {
            HStack {
                if source == .profile {
                    Button(action: onClose) {
                        Image(systemName: "chevron.backward")
                            .font(.system(size: 22, weight: .medium))
                            .foregroundColor(AppColors.textPrimary)
                    }
                }
            }
            .frame(width: 44, alignment: .leading)

            Text("Set Up Your Profile")
                .appText(Typography.sectionHeader)
                .foregroundColor(AppColors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)

            Color.clear.frame(width: 44)
        }
        .padding(.horizontal, 8)
        .frame(minHeight: 48)
    }

    // MARK: - Body

    private var body_: some View {
        VStack(spacing: 0) {
            Button(action: { showPhotoMenu = true }) {
                ZStack {
                    Circle()
                        .fill(AppColors.surface.opacity(0.5))
                        .overlay(
                            Circle().stroke(Color.white.opacity(0.06), lineWidth: 1)
                        )

                    if let pickedImage {
                        Image(uiImage: pickedImage)
                            .resizable()
                            .scaledToFill()
                            .clipShape(Circle())
                    } else if let avatarURL {
                        AsyncImage(url: avatarURL) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "person.fill")
                                .resizable()
                                .scaledToFit()
                                .padding(24)
                                .foregroundColor(AppColors.textMuted)
                        }
                        .clipShape(Circle())
                    } else {
                        Image(systemName: "person.fill")
                            .resizable()
                            .scaledToFit()
                            .padding(24)
                            .foregroundColor(AppColors.textMuted)
                    }

                    if uploading || saving {
                        Color.black.opacity(0.65)
                            .clipShape(Circle())
                        ProgressView()
                            .tint(AppColors.accent)
                    }
                }
                .frame(width: 96, height: 96)
                .clipShape(Circle())
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(uploading || saving)
            .padding(.top, 32)

            Button(action: { showPhotoMenu = true }) {
                Text((pickedImage != nil || avatarURL != nil) ? "Change Photo" : "Add Photo")
                    .appText(Typography.subtext)
                    .foregroundColor(AppColors.accent)
            }
            .disabled(uploading || saving)
            .padding(.top, 12)

            VStack(alignment: .leading, spacing: 6) {
                Text("Display Name")
                    .appText(TypographyPreset(family: .headingSemiBold, size: 14))
                    .foregroundColor(AppColors.textSecondary)
                    .padding(.bottom, 2)

                ZStack(alignment: .leading) {
                    if displayName.isEmpty {
                        Text("What should your guild call you?")
                            .foregroundColor(AppColors.textMuted)
                            .appText(Typography.body)
                            .allowsHitTesting(false)
                            .padding(.horizontal, 14)
                    }
                    TextField("", text: Binding(
                        get: { displayName },
                        set: { newValue in
                            displayName = String(newValue.prefix(maxNameLength))
                        }
                    ))
                    .foregroundColor(AppColors.textPrimary)
                    .appText(Typography.body)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled(true)
                    .padding(.horizontal, 14)
                }
                .frame(height: 52)
                .background(AppColors.surface.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Text("\(displayName.count)/\(maxNameLength)")
                    .appText(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text("Visible to your guild members")
                    .appText(Typography.caption)
                    .foregroundColor(AppColors.textMuted)
            }
            .padding(.top, 32)
            .padding(.horizontal, 24)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Bottom

    private var bottom: some View {
        VStack(spacing: 0) {
            // Save button (matches the muted-blue style of EditProfileScreen.tsx:443)
            Button(action: { Task { await onSave() } }) {
                Text("Save")
                    .appText(TypographyPreset(family: .headingSemiBold, size: 16))
                    .foregroundColor(AppColors.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(AppColors.primary.opacity(0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(AppColors.primary.opacity(0.25), lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .opacity(canSave && !saving ? 1.0 : 0.4)
            }
            .buttonStyle(PressOpacityButtonStyle())
            .disabled(!canSave || saving)

            if source == .signup {
                Button(action: onSkip) {
                    Text("Skip for now")
                        .appText(Typography.subtext)
                        .foregroundColor(AppColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .padding(.top, 8)
            }
        }
        .padding(24)
        .padding(.top, 12)
    }

    // MARK: - Computed

    private var trimmedName: String {
        displayName.trimmingCharacters(in: .whitespaces)
    }

    private var canSave: Bool {
        !trimmedName.isEmpty || pickedImage != nil || avatarURL != nil || didRemoveAvatar
    }

    // MARK: - Photo selection

    private func handlePickerSelection(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else { return }
            pickedImage = image
            // Picking a new photo cancels any prior removal intent — we'll
            // upload this one instead of clearing.
            didRemoveAvatar = false
            // Best-effort MIME inference from the picker item's supported types.
            let identifier = item.supportedContentTypes.first?.identifier ?? ""
            if identifier.contains("png") {
                pickedMime = "image/png"; pickedExt = "png"
            } else if identifier.contains("webp") {
                pickedMime = "image/webp"; pickedExt = "webp"
            } else if identifier.contains("heic") || identifier.contains("heif") {
                pickedMime = "image/heic"; pickedExt = "heic"
            } else {
                pickedMime = "image/jpeg"; pickedExt = "jpg"
            }
        } catch {
            alertTitle = "Couldn't load photo"
            alertMessage = error.localizedDescription
            showAlert = true
        }
    }

    // MARK: - Supabase I/O

    private func loadExistingProfile() async {
        guard let userId = auth.user?.id else { return }
        do {
            struct ProfileRow: Decodable {
                let display_name: String?
                let avatar_url: String?
            }
            let response: ProfileRow? = try await LockedInSupabase.shared.client
                .from("profiles")
                .select("display_name, avatar_url")
                .eq("id", value: userId.uuidString.lowercased())
                .single()
                .execute()
                .value
            if let row = response {
                if let name = row.display_name, !name.isEmpty {
                    displayName = name
                }
                if let urlString = row.avatar_url, let url = URL(string: urlString) {
                    avatarURL = url
                }
            }
        } catch {
            // Non-fatal: a missing profile row just renders an empty form.
            print("[EditProfileScreen] loadExistingProfile failed:", error)
        }
    }

    private func onSave() async {
        guard canSave else { return }
        guard let userId = auth.user?.id else {
            alertTitle = "Error"
            alertMessage = "Could not connect. Try again."
            showAlert = true
            return
        }

        saving = true
        defer { saving = false }

        var publicURL: String? = nil
        if let pickedImage {
            uploading = true
            let mime = pickedMime ?? "image/jpeg"
            let fileName = "avatar.\(pickedExt)"
            // Path follows RN convention: `{userId}/avatar.{ext}` with the
            // UUID lowercased (Supabase stores UUIDs lowercase and the
            // avatars bucket policy compares against `auth.uid()::text`).
            let path = "\(userId.uuidString.lowercased())/\(fileName)"

            let data: Data?
            switch pickedExt {
            case "png":
                data = pickedImage.pngData()
            default:
                data = pickedImage.jpegData(compressionQuality: 0.7)
            }
            guard let bytes = data else {
                uploading = false
                alertTitle = "Upload failed"
                alertMessage = "Could not encode image"
                showAlert = true
                return
            }

            do {
                _ = try await LockedInSupabase.shared.client.storage
                    .from("avatars")
                    .upload(
                        path,
                        data: bytes,
                        options: FileOptions(contentType: mime, upsert: true)
                    )
                let url = try LockedInSupabase.shared.client.storage
                    .from("avatars")
                    .getPublicURL(path: path)
                publicURL = url.absoluteString
            } catch {
                uploading = false
                alertTitle = "Upload failed"
                alertMessage = error.localizedDescription
                showAlert = true
                return
            }
            uploading = false
        } else if let existing = avatarURL?.absoluteString {
            publicURL = existing
        }

        // Update profiles row.
        //
        // Three branches, in priority order:
        //  1. `didRemoveAvatar` → explicitly null out `avatar_url` so the DB
        //     reflects the removal. Without this branch the column stays
        //     stuck at its previous value.
        //  2. `publicURL != nil` → either a fresh upload or the existing URL
        //     is being preserved; write it back.
        //  3. Otherwise → name-only patch, leaving `avatar_url` untouched
        //     (the user never touched the avatar UI).
        do {
            // Custom `encode(to:)` so the `avatar_url` key is always emitted
            // (Swift's auto-synthesized Encodable uses `encodeIfPresent` for
            // optionals — silently stripping `nil` values from the PATCH body
            // and leaving the DB column untouched, which is exactly the bug
            // this profile-removal flow is fighting).
            struct ProfileUpdateAvatarExplicit: Encodable {
                let display_name: String?
                let avatar_url: String?  // nil → encodes as JSON null

                enum CodingKeys: String, CodingKey {
                    case display_name
                    case avatar_url
                }

                func encode(to encoder: Encoder) throws {
                    var c = encoder.container(keyedBy: CodingKeys.self)
                    // `encode(_:forKey:)` (not `encodeIfPresent`) emits an
                    // explicit `null` when the optional is `nil`.
                    try c.encode(display_name, forKey: .display_name)
                    try c.encode(avatar_url, forKey: .avatar_url)
                }
            }
            struct ProfileUpdateNameOnly: Encodable {
                let display_name: String?
            }
            let nameOrNil: String? = trimmedName.isEmpty ? nil : trimmedName

            if didRemoveAvatar {
                let body = ProfileUpdateAvatarExplicit(display_name: nameOrNil, avatar_url: nil)
                _ = try await LockedInSupabase.shared.client
                    .from("profiles")
                    .update(body)
                    .eq("id", value: userId.uuidString.lowercased())
                    .execute()
            } else if let publicURL {
                let body = ProfileUpdateAvatarExplicit(display_name: nameOrNil, avatar_url: publicURL)
                _ = try await LockedInSupabase.shared.client
                    .from("profiles")
                    .update(body)
                    .eq("id", value: userId.uuidString.lowercased())
                    .execute()
            } else {
                let body = ProfileUpdateNameOnly(display_name: nameOrNil)
                _ = try await LockedInSupabase.shared.client
                    .from("profiles")
                    .update(body)
                    .eq("id", value: userId.uuidString.lowercased())
                    .execute()
            }
        } catch {
            alertTitle = "Save failed"
            alertMessage = error.localizedDescription
            showAlert = true
            return
        }

        if publicURL != nil {
            AuthAnalytics.log(AuthAnalytics.profilePhotoSet, properties: [
                "source": source == .signup ? "signup_flow" : "settings",
                "method": pickedImage != nil ? "upload" : "existing"
            ])
        }
        if !trimmedName.isEmpty {
            AuthAnalytics.log(AuthAnalytics.displayNameSet, properties: [
                "source": source == .signup ? "signup_flow" : "settings",
                "name_length": trimmedName.count
            ])
        }

        onSaved()
    }

    private func onSkip() {
        AuthAnalytics.log(AuthAnalytics.profileSetupSkipped)
        onSaved()
    }
}
