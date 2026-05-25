import Foundation
import Supabase

/// Singleton wrapper around `supabase-swift`. Reads `SUPABASE_URL` and
/// `SUPABASE_ANON_KEY` from the embedded `LockedInConfig` plist section
/// (sourced from xcconfig at build time).
///
/// Phase 1 workers depend on the `.shared.client` `SupabaseClient` for all
/// `.from() / .rpc() / .functions.invoke() / .auth / .storage` calls.
public final class LockedInSupabase {
    public static let shared = LockedInSupabase()

    public let client: SupabaseClient

    private init() {
        guard let urlString = LockedInConfig.string(.supabaseURL),
              let url = URL(string: urlString)
        else {
            fatalError("Missing SUPABASE_URL — provide via Config/Secrets.xcconfig.")
        }
        guard let key = LockedInConfig.string(.supabaseAnonKey) else {
            fatalError("Missing SUPABASE_ANON_KEY — provide via Config/Secrets.xcconfig.")
        }

        self.client = SupabaseClient(supabaseURL: url, supabaseKey: key)
    }
}
