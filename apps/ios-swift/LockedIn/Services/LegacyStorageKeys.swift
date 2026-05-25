//
//  LegacyStorageKeys.swift
//  LockedIn
//
//  Canonical inventory of `@lockedin/*` UserDefaults keys that exist in the RN
//  install base but are not yet read or written by any Swift feature.
//
//  Why this file exists:
//  - The Crew→Guild migration in the RN app left behind a known set of legacy
//    keys (e.g. `@lockedin/crew_*`) that must be PRESERVED on upgrade. Future
//    Swift code (NotificationService, AppGuide, StorageMigrations) reads these
//    by name; declaring them here keeps the inventory complete and prevents
//    typo drift.
//  - The Phase 3 fidelity re-audit (`MIGRATION_FIDELITY_REAUDIT.md`) flagged
//    these as MISSING from the Swift port. They are not "dead code" — they
//    are the keys the coordinator and future contributors will reference.
//
//  RULE: never rename a key here. The RN install base owns these names.
//

import Foundation

/// Keys live in this file to satisfy the persistence-parity contract from
/// `MIGRATION_FRONTEND_INVENTORY.md` §4 and `MIGRATION_FIDELITY_REAUDIT.md`.
public enum LegacyStorageKeys {
    // MARK: - Notification / engagement keys

    /// Cached OS notification permission state from the last permission check.
    /// Owner: NotificationService.
    public static let notifPermissionGranted   = "@lockedin/notif_permission_granted"

    /// Set of streak-milestone day numbers already notified (JSON [Int]).
    /// Owner: NotificationService.
    public static let milestoneNotifsSent      = "@lockedin/milestone_notifs_sent"

    /// "First guild nudge" sheet has been shown once. Bool.
    /// Owner: NotificationService / GuildState. Mirrors the legacy
    /// `crew_first_nudge_sent` key from before the Crew→Guild rename.
    public static let guildFirstNudgeSent      = "@lockedin/guild_first_nudge_sent"

    /// Last cached guild rank tier; used by the home HUD to avoid a flash of
    /// stale rank between launches.
    public static let guildCachedRank          = "@lockedin/guild_cached_rank"

    /// Last app open timestamp (ms epoch). Used by win-back notif scheduling.
    public static let lastAppOpen              = "@lockedin/last_app_open"

    // MARK: - App-guide tutorial keys (dynamic per-screen)

    /// Returns the dynamic key for a given guide id, matching RN's
    /// `@lockedin/guide_<id>` pattern. Example: `guide("home")`.
    public static func guide(_ id: String) -> String { "@lockedin/guide_\(id)" }

    // MARK: - Migration markers

    /// Set once when the Crew→Guild data migration has run for the installed
    /// user. Both standard and App Group suites must check this so the
    /// migration never repeats.
    public static let migrationsCrewToGuildV1  = "@lockedin/migrations_crew_to_guild_v1"

    // MARK: - Legacy Crew (pre-rename) keys — PRESERVE for upgrade-path safety

    /// Legacy: first-crew-nudge marker. Read on launch; if set and
    /// `guildFirstNudgeSent` is unset, migrate the value forward.
    public static let crewFirstNudgeSent       = "@lockedin/crew_first_nudge_sent"

    /// Legacy: cached weekly crew score blob. Mirror to the new
    /// `@lockedin/guild_week_stats` on migration.
    public static let crewWeekStats            = "@lockedin/crew_week_stats"

    /// Legacy: cached crew rank. Mirror to `guildCachedRank` on migration.
    public static let crewCachedRank           = "@lockedin/crew_cached_rank"

    /// Legacy: crew app-guide tutorial dismissal. (Reference only — RN's
    /// `StorageMigrations.ts` does NOT mirror this key, so the Swift port
    /// does not either.)
    public static let crewGuideDismissed       = "@lockedin/guide_crew"

    /// Legacy: cached "user belongs to an active crew" flag. Mirror to
    /// `@lockedin/has_active_guild` on migration.
    public static let hasActiveCrew            = "@lockedin/has_active_crew"

    /// Legacy: notif-toggle for crew updates. Mirror to
    /// `@lockedin/notif_guild_updates` on migration.
    public static let notifCrewUpdates         = "@lockedin/notif_crew_updates"
}
