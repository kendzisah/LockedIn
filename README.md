# LockedIn Monorepo

## Quick Start
```bash
pnpm install
pnpm mobile           # Expo dev server (Metro)
pnpm admin            # Next.js admin dashboard
pnpm --filter marketing dev   # Marketing Vite app
pnpm dev              # Both concurrently
pnpm supabase:push    # Apply migrations
pnpm supabase:gen-types  # Regenerate DB types
```

## Structure
```
apps/mobile    - React Native (Expo) mobile app
apps/admin     - Next.js admin dashboard
apps/marketing - Vite marketing site
packages/      - Shared TypeScript packages (platform-agnostic, no RN imports)
supabase/      - Migrations + Edge Functions
```

## Weekly Report Example
Example weekly report payload used by the mobile app.

```json
{
  "weekStartDate": "2026-04-14T00:00:00.000Z",
  "daysLockedIn": 5,
  "totalFocusMinutes": 240,
  "missionsCompleted": 12,
  "totalMissions": 14,
  "streakDays": 15,
  "grade": "A",
  "previousGrade": "B+",
  "percentile": 88
}
```

## Native builds
`android/` and `ios/` are NOT committed. They are ephemeral.
- Local dev: `cd apps/mobile && npx expo prebuild --platform android`
- Production: EAS Build (managed)
