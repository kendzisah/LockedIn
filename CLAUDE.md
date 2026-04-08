# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
pnpm install              # Install all dependencies
pnpm mobile               # Start Expo dev server (Metro)
pnpm admin                # Start Next.js admin dashboard (port 3000)
pnpm dev                  # Run both concurrently
pnpm build                # Build all packages
pnpm lint                 # Lint all packages
pnpm typecheck            # TypeScript check across all packages
pnpm supabase:push        # Apply database migrations
pnpm supabase:gen-types   # Regenerate DB TypeScript types
```

Mobile native builds: `android/` and `ios/` dirs are ephemeral (not committed). Use `cd apps/mobile && npx expo prebuild --platform android` for local native builds, or EAS Build for production.

No test suite is configured in this repo.

## Architecture

**Monorepo** using pnpm workspaces:
- `apps/mobile` — React Native (Expo 54) mobile app
- `apps/admin` — Next.js 15 admin dashboard (React 19, Tailwind, Clerk auth)
- `packages/shared-types` — Pure TypeScript types shared across apps (no RN imports)
- `packages/supabase-client` — Supabase client factory, auth helpers, storage utilities
- `supabase/` — PostgreSQL migrations and edge functions

### Mobile App (`apps/mobile/src`)

**Feature-folder organization** — each feature is self-contained with `screens/`, `components/`, `state/` (context providers), and service files:
- `features/auth` — Supabase auth (anonymous-first, email, Apple Sign-In, account linking)
- `features/home` — Main screen, session engine
- `features/onboarding` — Onboarding flow and user preference capture
- `features/missions` — 3-slot mission recommendation engine
- `features/leaderboard`, `features/settings`, `features/subscription`, `features/streak`, etc.

**State management** uses nested React Context providers (`AuthProvider` > `OnboardingProvider` > `SessionProvider` > `SubscriptionProvider` > `MissionsProvider`). No Redux or Zustand.

**Navigation**: React Navigation 7.x — `RootNavigator` decides between `OnboardingNavigator` and `MainNavigator` (bottom tabs + modal stacks).

**Services** (`services/`) are singleton objects (not DI): `SupabaseService`, `NotificationService`, `AuthService`, `SubscriptionService` (RevenueCat), `AppsFlyerService`, `MixpanelService`, `CrewService`.

**Design system**: `design/` contains color tokens, typography, streak tier definitions. Reusable components in `design/components/`.

### Admin Dashboard (`apps/admin`)

Next.js App Router with Clerk auth + Supabase SSR. Middleware enforces email allowlist. Key routes: `/dashboard/*` (protected admin), `/api/signed-upload-url`, `/api/validate-duration`. Tailwind CSS with HSL CSS variable theming, dark mode by default.

### Backend

Supabase as BaaS — PostgreSQL with RLS policies enforcing authorization at DB level. Two roles: `user` and `admin`. Auto-creates profile on signup via trigger. Audio tracks stored in Supabase Storage.

## Folder Structure & Naming Conventions

### Feature Folder Template (Mobile)

```
features/{featureName}/
├── {FeatureService}.ts           # Service class if needed
├── {FeatureProvider}.tsx          # State provider + context hook
├── {FeatureName}Data.ts           # Static data/constants
├── {FeatureName}Engine.ts         # Business logic
├── {featureName}Constants.ts      # Feature-level constants
├── index.ts                       # Barrel export (public API)
├── screens/
│   └── {ScreenName}Screen.tsx     # Navigable screens
├── components/
│   └── {ComponentName}.tsx        # Feature-specific UI
├── hooks/
│   └── use{HookName}.ts          # Feature hooks
├── state/
│   ├── {FeatureProvider}.tsx      # Provider
│   └── types.ts                   # State types
└── sheets/
    └── {SheetName}Sheet.tsx       # Bottom sheets/modals
```

### File Naming Rules

- **PascalCase**: Components (`.tsx`), Services, Providers, Screens, Modals/Sheets, Engines
- **camelCase**: Config files (`env.ts`), constants, utilities, storage helpers
- **Hooks**: Always `use{Name}.ts`
- **Screens**: Always `{Name}Screen.tsx`
- **Sheets**: Always `{Name}Sheet.tsx`

### Import Conventions

- **Monorepo packages**: `@lockedin/shared-types`, `@lockedin/supabase-client`
- **Admin local imports**: `@/*` alias
- **Within features**: Relative paths
- **Barrel exports** (`index.ts`) in features expose the public API — import from the feature root, not internal files

### Navigation Hierarchy

```
RootNavigator (conditional: onboarding vs main)
├── OnboardingNavigator (stack)
└── MainNavigator
    └── TabNavigator (bottom tabs)
        ├── HomeTab, MissionsTab, LockInTab, BoardTab, ProfileTab
    ├── PaywallOffer, ExecutionBlock, SessionComplete (modals)
    ├── SignUp, SignIn, EditProfile, WeeklyReport, CrewDetail
```

Navigation types defined in `types/navigation.ts`. Imperative navigation via `rootNavigationRef`.

## Structural Rules

1. **One feature per folder** under `features/` — screens, components, state, and services colocated
2. **Services are singletons** — instantiated at module bottom, exported as objects (not classes)
3. **State uses Context + useReducer** — types in separate `types.ts`, provider exports a `use{Feature}` hook
4. **Shared packages must stay platform-agnostic** — no React Native imports in `packages/`
5. **Env vars validated at startup** in `config/env.ts` via `requireEnv()` — fail fast on missing vars
6. **RLS-first security** — authorization enforced at Supabase DB level, not in app code
7. **Anonymous-first auth** — mobile users start anonymous, can link email/Apple accounts later
8. **Persistence** via AsyncStorage with keys like `@lockedin/{feature}_{state}`

## Visual Design System

The app uses a **dark, glassmorphic, high-end aesthetic** — deep graphite backgrounds, subtle translucent surfaces, soft glows, and precise typography. Every new screen and component must follow these principles.

### Color Palette (`design/colors.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| **Background** | `#0E1116` | Primary app background |
| **Background Secondary** | `#151A21` | Cards, surfaces |
| **Surface** | `#2C3440` | Elevated surfaces, dividers, disabled states |
| **Lock In Active** | `#090C10` | Immersive/focus mode |
| **Primary (Discipline Blue)** | `#3A66FF` | Buttons, CTAs, active states, progress |
| **Accent (Electric Cyan)** | `#00C2FF` | Streaks, active highlights (use sparingly) |
| **Text Primary** | `#FFFFFF` | High-contrast text |
| **Text Secondary** | `#9CA3AF` | Secondary text |
| **Text Muted** | `#6B7280` | Tertiary text, placeholders |
| **Success** | `#00D68F` | Positive feedback |
| **Danger** | `#FF4757` | Errors, destructive actions |
| **Warning** | `#FFC857` | Warnings |

### Typography (`design/typography.ts`)

**Two font families:**
- **Inter Tight** — Headlines and buttons. Compressed, intentional feel.
  - ExtraBold (800): Hero text only
  - Bold (700): Screen headings
  - SemiBold (600): Section headers, buttons
- **Inter** — Body text. Neutral, extremely readable.
  - Medium (500): Emphasized body
  - Regular (400): Default body, captions

**Scale:**
- Hero: 36px / -0.5 tracking (rare, major statements only)
- Heading: 28px / -0.3 tracking
- Section Header: 22px / -0.2 tracking
- Body: 16px
- Subtext: 14px
- Caption: 12px
- Button: 17px / -0.1 tracking (InterTight SemiBold)

### Glassmorphism Patterns

**Every surface in the app uses translucency and subtle borders — never flat opaque cards.**

**Glass card (standard):**
```tsx
backgroundColor: 'rgba(21,26,33,0.5)'    // backgroundSecondary at ~50% opacity
borderRadius: 14-18
borderWidth: 1
borderColor: 'rgba(255,255,255,0.04)'     // barely-visible white border
padding: 14-20
```

**Glass card (prominent, e.g. form containers):**
```tsx
backgroundColor: 'rgba(21,26,33,0.72)'
borderRadius: 18
borderWidth: 1
borderColor: 'rgba(255,255,255,0.07)'
// Add inner glow orb: absolute positioned circle with rgba(58,102,255,0.06)
```

**Input fields:**
```tsx
backgroundColor: 'rgba(255,255,255,0.04)'
borderWidth: 1
borderColor: 'rgba(255,255,255,0.08)'
borderRadius: 14
padding: 16 horizontal, 14 vertical
minHeight: 52
color: '#FFFFFF'
placeholderTextColor: '#6B7280'
```

**Gradient backgrounds (screens):**
```tsx
<LinearGradient colors={['#0E1116', '#111922', '#0E1116']} locations={[0, 0.5, 1]} />
```

**Glow orbs (ambient depth):**
```tsx
// Position absolutely behind content. Use 1-2 per screen.
{ position: 'absolute', width: 220, height: 220, borderRadius: 110,
  backgroundColor: 'rgba(58,102,255,0.06)' }  // blue glow
// Or cyan for secondary glow:
{ backgroundColor: 'rgba(0,194,255,0.05)' }
```

### Button Styles

**Primary CTA (glassmorphic blue):**
```tsx
backgroundColor: 'rgba(58,102,255,0.42)'
borderWidth: 1
borderColor: 'rgba(120,160,255,0.55)'
borderRadius: 28
paddingVertical: 16
minHeight: 54
shadowColor: '#3A66FF'
shadowOpacity: 0.35
shadowRadius: 14
```

**Solid primary (design system PrimaryButton):**
```tsx
backgroundColor: '#3A66FF'
borderRadius: 12
paddingVertical: 16
paddingHorizontal: 48
activeOpacity: 0.8
```

**Secondary/outline:**
```tsx
backgroundColor: 'transparent'
borderWidth: 1
borderColor: '#2C3440'
borderRadius: 12
```

**Ghost button (glass):**
```tsx
backgroundColor: 'rgba(255,255,255,0.04)'
borderRadius: 28
borderWidth: 1
borderColor: 'rgba(255,255,255,0.08)'
```

### Animation Conventions

- **Fade transitions**: 400-600ms with `Easing.inOut` or `Easing.ease`
- **Spring animations**: `friction: 8, tension: 40` for bounce effects
- **Button shine sweep**: Animated `LinearGradient` translating left-to-right over 1800ms, repeating every 2500ms. Colors: `['transparent', 'rgba(255,255,255,0.22)', 'rgba(180,210,255,0.35)', 'transparent']`
- **Progress animations**: 800ms timing
- **Active/pressed opacity**: 0.8 (never 0.5)
- **Staggered entry**: Sequential fade-ins with 200-600ms delays for onboarding-style reveals

### Streak Tier Colors (`design/streakTiers.ts`)

Progressive color system based on consecutive days:
- 3 days: `#FF6B35` (orange)
- 7 days: `#FFD700` (gold)
- 1 month: `#00D68F` (green)
- 3 months: `#00C2FF` (cyan)
- 6 months: `#8B5CF6` (purple)
- 1 year: `#FF006E` (pink)
- 365+: Rotating cycle through all colors (~60 days each)
- Default (< 3 days): `#4B5563`

Used in Lottie flame animation color filters and streak UI elements.

### Spacing & Sizing Conventions

- **Screen padding**: 24px horizontal, 16px vertical
- **Card padding**: 14-20px
- **Button padding**: 16px vertical, 48px horizontal (solid), 56px horizontal (glass)
- **Border radius scale**: Large containers 16-20, buttons/inputs 12-14, small elements 8-10, pills 20-28
- **Gaps**: 4-6px tight, 8-12px normal, 16-20px loose
- **Bottom sheet**: maxHeight 88% of screen, borderTopRadius 20, handle bar 40x4

### Opacity & Transparency Rules

- Never use flat opaque cards — always use rgba backgrounds
- Primary glass surfaces: 0.5-0.72 alpha
- Hover/pressed overlay: `rgba(255,255,255,0.04)`
- Borders: `rgba(255,255,255,0.04)` to `rgba(255,255,255,0.08)`
- Glow orbs: 0.05-0.07 alpha
- Disabled elements: Use `#2C3440` surface color, not opacity
- Text dimming: Use explicit muted color (`#6B7280`), not opacity on white

### Modal & Sheet Patterns

**Bottom sheet:**
```tsx
backgroundColor: '#151A21'
borderTopLeftRadius: 20
borderTopRightRadius: 20
// Handle bar: 40x4, borderRadius 2, backgroundColor '#2C3440', centered
```

**Centered modal:**
```tsx
// Overlay: backgroundColor 'rgba(0,0,0,0.6)', centered
// Card: width 85%, backgroundColor '#2C3440', borderRadius 16, padding 32 vertical / 24 horizontal
```

### Admin Dashboard Theme (`apps/admin`)

HSL CSS variables in `globals.css` — dark theme matching the mobile palette:
- Background: `hsl(220, 20%, 7%)` — deep dark
- Cards: `hsl(220, 18%, 10%)`
- Primary: `hsl(215, 95%, 58%)` — matches Discipline Blue
- Borders: `hsl(215, 12%, 22%)`
- Custom Tailwind colors: `surface: #161B22`, `text-primary: #E6EDF3`, `text-secondary: #8B949E`
- Components use `class-variance-authority` for variant-driven styling
- Base radius: `0.5rem` (8px)
