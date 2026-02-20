# LockedIn Monorepo

## Quick Start
```bash
pnpm install
pnpm mobile           # Expo dev server (Metro)
pnpm admin            # Next.js admin dashboard
pnpm dev              # Both concurrently
pnpm supabase:push    # Apply migrations
pnpm supabase:gen-types  # Regenerate DB types
```

## Structure
```
apps/mobile    - React Native (Expo) mobile app
apps/admin     - Next.js admin dashboard
packages/      - Shared TypeScript packages (platform-agnostic, no RN imports)
supabase/      - Migrations + Edge Functions
```

## Native builds
`android/` and `ios/` are NOT committed. They are ephemeral.
- Local dev: `cd apps/mobile && npx expo prebuild --platform android`
- Production: EAS Build (managed)
