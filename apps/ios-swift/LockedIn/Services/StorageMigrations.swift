//
//  StorageMigrations.swift
//  LockedIn
//
//  One-shot UserDefaults migrations that run at app launch. Each migration is
//  idempotent and gated by a `@lockedin/migrations_*` sentinel key so it runs
//  exactly once per install.
//
//  Mirrors the RN migration helpers that ran on first launch after the
//  Crew→Guild rename. See `MIGRATION_FRONTEND_INVENTORY.md` §4 (AsyncStorage
//  keys) for the legacy key inventory.
//

import Foundation

@MainActor
public enum StorageMigrations {
    /// Runs every queued migration in order. Safe to call multiple times —
    /// each individual migration self-gates on its sentinel key.
    public static func runAll() {
        crewToGuildV1()
    }

    /// Mirror every legacy `crew_*` UserDefaults key into the new `guild_*`
    /// names so guild features can read a single canonical key set. Runs once
    /// per install (sentinel: `@lockedin/migrations_crew_to_guild_v1`).
    ///
    /// 1:1 port of `apps/mobile/src/services/StorageMigrations.ts`. The five
    /// pairs and the delete-after-mirror behavior are taken verbatim from the
    /// RN source — adding or removing any pair here causes silent drift for
    /// users upgrading from the RN install base.
    ///
    /// Sentinel value is the string `"true"` (matching RN's `AsyncStorage`
    /// write) so a Swift cold-launch after an RN-side migration recognises
    /// the prior run and skips. A Swift-first install writes the same string.
    private static func crewToGuildV1() {
        let sentinel = LegacyStorageKeys.migrationsCrewToGuildV1
        if Defaults.string(sentinel) == "true" { return }

        let std = UserDefaults.standard

        // Per RN: if `from` exists, mirror to `target` only when `target` is
        // empty, then DELETE `from` so a re-run of the migration is a no-op.
        func mirror(_ from: String, _ target: String) {
            guard let value = std.object(forKey: from) else { return }
            if std.object(forKey: target) == nil {
                std.set(value, forKey: target)
            }
            std.removeObject(forKey: from)
        }

        // Five pairs, in RN order (StorageMigrations.ts:19-25).
        mirror(LegacyStorageKeys.crewWeekStats,       "@lockedin/guild_week_stats")
        mirror(LegacyStorageKeys.crewCachedRank,      LegacyStorageKeys.guildCachedRank)
        mirror(LegacyStorageKeys.hasActiveCrew,       "@lockedin/has_active_guild")
        mirror(LegacyStorageKeys.crewFirstNudgeSent,  LegacyStorageKeys.guildFirstNudgeSent)
        mirror(LegacyStorageKeys.notifCrewUpdates,    "@lockedin/notif_guild_updates")

        Defaults.setString("true", sentinel)
    }
}
