# Supabase Skill

Use this skill for any task that involves the Supabase database, storage, auth, or schema changes in the LockedIn project.

## Project Details

- **Project ID**: `dfwnylvggzlfovzkmgik`
- **Project Ref**: `dfwnylvggzlfovzkmgik`
- **Region**: `ca-central-1`
- **Postgres Version**: 17.6
- **Database Host**: `db.dfwnylvggzlfovzkmgik.supabase.co`

## Schema Overview

### Enums

| Enum | Values |
|------|--------|
| `user_role` | `user`, `admin` |
| `session_phase` | `lock_in`, `unlock` |
| `session_status` | `draft`, `published`, `archived` |

### Tables

**`profiles`** (320 rows) — User profiles, auto-created on signup via `handle_new_user` trigger.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | FK → `auth.users.id` |
| `display_name` | text (nullable) | 1-20 chars |
| `avatar_url` | text (nullable) | |
| `role` | `user_role` | Default `'user'` |
| `created_at` | timestamptz | Default `now()` |

**`audio_tracks`** (181 rows) — Audio content metadata.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `title` | text | |
| `category` | text | |
| `storage_path` | text | Path within storage bucket |
| `storage_bucket` | text | Default `'audio'` |
| `duration_seconds` | integer | |
| `voice_id` | text (nullable) | |
| `script_version` | text (nullable) | |
| `hash` | text (nullable) | |
| `sort_order` | integer | Default `0` |
| `is_active` | boolean | Default `true` |
| `day_number` | integer (nullable) | 1-90 range check |
| `core_tenet` | text (nullable) | |
| `created_at` | timestamptz | Default `now()` |

**`scheduled_sessions`** (0 rows) — Daily scheduled sessions.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `scheduled_date` | date | |
| `phase` | `session_phase` | `lock_in` or `unlock` |
| `duration_minutes` | integer | Must be 5, 10, 15, or 20 |
| `audio_track_id` | uuid | FK → `audio_tracks.id` |
| `title` | text | |
| `recommended_time_local` | time (nullable) | |
| `published_at` | timestamptz (nullable) | |
| `status` | `session_status` | Default `'draft'` |
| `is_active` | boolean | Default `false` |
| `created_at` | timestamptz | Default `now()` |

**`crews`** (0 rows) — User crews/groups.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `name` | text | 1-30 chars |
| `invite_code` | text (unique) | |
| `owner_id` | uuid | FK → `auth.users.id` |
| `max_members` | smallint | Default `10` |
| `created_at` | timestamptz | Default `now()` |

**`crew_members`** (0 rows) — Crew membership.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `crew_id` | uuid | FK → `crews.id` |
| `user_id` | uuid | FK → `auth.users.id` |
| `role` | text | `'owner'` or `'member'`, default `'member'` |
| `joined_at` | timestamptz | Default `now()` |

**`crew_scores`** (0 rows) — Weekly leaderboard scores per crew member.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default `gen_random_uuid()` |
| `crew_id` | uuid | FK → `crews.id` |
| `user_id` | uuid | FK → `auth.users.id` |
| `week_key` | text | ISO week string |
| `focus_minutes` | integer | Default `0` |
| `missions_done` | integer | Default `0` |
| `streak_days` | integer | Default `0` |
| `total_score` | integer | Default `0` |
| `updated_at` | timestamptz | Default `now()` |

### Database Functions

| Function | Args | Returns | Purpose |
|----------|------|---------|---------|
| `handle_new_user()` | — | trigger | Auto-creates profile on `auth.users` insert |
| `is_admin()` | — | boolean | Checks if current user has `admin` role |
| `is_crew_member(cid)` | uuid | boolean | Checks if current user belongs to crew |
| `create_crew(crew_name)` | text | jsonb | Creates crew + owner membership, returns crew data |
| `join_crew(code)` | text | jsonb | Joins crew by invite code |
| `generate_invite_code()` | — | text | Generates unique invite code |
| `get_iso_week(ts)` | timestamptz | text | Returns ISO week string (default `now()`) |
| `delete_own_account()` | — | void | Deletes the calling user's account |
| `promote_to_admin(target_user_id)` | uuid | void | Promotes user to admin role |

### RLS Policies

**profiles:**
- Anyone can SELECT all profiles
- Admins can SELECT all profiles
- Users can SELECT own profile
- Users can UPDATE own profile (where `auth.uid() = id`)

**audio_tracks:**
- Admins: ALL operations via `is_admin()`
- Authenticated users: SELECT where `is_active = true`

**scheduled_sessions:**
- Admins: ALL operations via `is_admin()`
- Authenticated users: SELECT where `status = 'published' AND is_active = true`

**crews:**
- INSERT: where `owner_id = auth.uid()`
- SELECT: where `is_crew_member(id)`
- DELETE: where `owner_id = auth.uid()`

**crew_members:**
- INSERT: where `user_id = auth.uid()`
- SELECT: where `is_crew_member(crew_id)`
- DELETE: where `user_id = auth.uid()`

**crew_scores:**
- INSERT: where `user_id = auth.uid() AND is_crew_member(crew_id)`
- SELECT: where `is_crew_member(crew_id)`
- UPDATE: where `user_id = auth.uid() AND is_crew_member(crew_id)`

### Storage Buckets

| Bucket | Public | Policies |
|--------|--------|----------|
| `audio` | No | Authenticated can download; admins can upload/update/delete |
| `avatars` | No | Authenticated can view all; users can upload/update/delete own (folder = `{uid}/`) |

## Migration Conventions

Migrations live in `supabase/migrations/` and are numbered sequentially: `00001_initial_schema.sql`, `00002_storage_policies.sql`, etc.

When creating new migrations:
1. Use the `apply_migration` MCP tool with the project ID above
2. Name in `snake_case` (the tool prepends the timestamp)
3. Always include `IF NOT EXISTS` / `IF EXISTS` guards for safety
4. Add RLS policies for any new tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
5. After DDL changes, run `pnpm supabase:gen-types` to regenerate TypeScript types in `packages/supabase-client/src/types.ts`

## Common Operations

### Query data
Use `execute_sql` with project ID `dfwnylvggzlfovzkmgik` for SELECT queries and data manipulation (INSERT/UPDATE/DELETE).

### Schema changes
Use `apply_migration` for any DDL (CREATE TABLE, ALTER TABLE, CREATE POLICY, etc.). Never use `execute_sql` for DDL.

### Check table structure
Use `list_tables` with `verbose: true` and `schemas: ["public"]`.

### Regenerate types after schema changes
After any migration, remind the user to run:
```bash
pnpm supabase:gen-types
```

### Client usage in code
- **Mobile**: `createMobileClient(url, anonKey, storage?)` from `@lockedin/supabase-client`
- **Admin server**: `createAdminClient(url, serviceRoleKey)` from `@lockedin/supabase-client` (server actions only)
- **Auth**: `ensureAnonymousSession(client)` for mobile anonymous auth
- **Storage**: `getSignedAudioUrl(client, bucket, path, ttl?)` and `getSignedUploadUrl(client, bucket, path)` for file access
