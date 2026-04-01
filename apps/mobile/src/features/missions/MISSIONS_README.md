# Daily Missions System

A personalized daily mission system for the Locked In app that generates 3 missions per day based on the user's primary goal, with completion tracking and XP rewards.

## Architecture

### 1. **MissionEngine.ts**
Core engine for mission generation and management.

**Key Functions:**
- `getMissionsForGoal(goal: string, date?: Date): Mission[]` - Generates 3 personalized missions for a user's goal
- `calculateTotalXP(missions: Mission[]): number` - Sums XP from completed missions
- `getCompletedCount(missions: Mission[]): number` - Counts completed missions

**Mission Types:**
- `focus_session` - Deep work sessions
- `workout_check` - Fitness check-ins
- `reflection` - Daily reflection prompts
- `no_social` - Social media avoidance challenges
- `journal` - Journaling prompts
- `reading` - Reading assignments
- `planning` - Goal/task planning
- `custom` - User-defined missions

**Goal-Specific Missions:**
Each primary goal gets customized missions:
- **Improve my physique**: Focus + Workout + No Social Media
- **Build a business/side project**: Deep Work + Write Priorities + Review Progress
- **Increase discipline & self-control**: Morning Focus + No Social Media + Evening Reflection
- **Advance my career**: Focus Session + Reading + Planning
- **Study with consistency**: Study Session + Review Notes + Stay Distraction-Free
- **Reduce distractions**: Focus Session + No Social Media + End-of-Day Reflection
- **Improve emotional control**: Mindful Focus + Emotional Check-In + Reflection

### 2. **MissionsProvider.tsx**
React Context for global mission state with AsyncStorage persistence.

**State:**
```typescript
{
  missions: Mission[]           // Today's 3 missions
  date: string                  // ISO date string (YYYY-MM-DD)
  completedCount: number        // Count of completed missions
  totalXP: number              // XP earned from completed missions
  lockedInToday: boolean       // true when all 3 missions done
}
```

**Actions:**
- `completeMission(missionId: string)` - Mark a mission as complete
- `generateDailyMissions(goal: string)` - Generate new missions for a goal
- `resetDay()` - Reset missions for a new day

**Persistence:**
- Stores missions to `@lockedin/daily_missions` (AsyncStorage)
- Auto-hydrates on app launch
- Detects stale missions and regenerates daily

### 3. **MissionCard.tsx**
Individual mission card component.

**Features:**
- Shows mission title, description, and XP reward
- Visual feedback: green checkmark + strikethrough when completed
- Accent color left border for uncompleted missions
- Haptic feedback on completion (success vibration)
- Disabled state once completed

**Props:**
```typescript
{
  mission: Mission
  onComplete: (missionId: string) => void
}
```

### 4. **MissionsPanel.tsx**
Container panel displaying all 3 daily missions.

**Features:**
- Header with "Daily Missions" title
- Flame icon (🔥) when all missions complete
- Completion counter (X/3 Complete)
- Mission cards in vertical scrollable list
- XP earned counter
- "LOCKED IN" badge with subtle glow when all complete
- Optional ScrollView wrapper for embeddability

**Props:**
```typescript
{
  showScrollView?: boolean  // Wrap in ScrollView (default: false)
}
```

## Usage

### Setup (App.tsx or root component)
```tsx
import { MissionsProvider } from './features/missions';

export default function App() {
  const userGoal = 'Build a business or side project'; // From onboarding

  return (
    <MissionsProvider userGoal={userGoal}>
      <HomeScreen />
    </MissionsProvider>
  );
}
```

### In Components (HomeScreen.tsx)
```tsx
import { MissionsPanel } from './features/missions';

export function HomeScreen() {
  return (
    <View>
      <Text>Welcome Back</Text>
      <MissionsPanel />
    </View>
  );
}
```

### Access Missions Directly
```tsx
import { useMissions } from './features/missions';

export function CustomComponent() {
  const { missions, completedCount, totalXP, lockedInToday, completeMission } = useMissions();

  return (
    // Use missions state...
  );
}
```

## Mission Generation Logic

Missions are generated deterministically based on:
1. User's primary goal (from onboarding)
2. Day of year (ensures same 3 missions for entire day)
3. Goal-specific templates

Each mission includes:
- Unique ID (based on day + index)
- Title & description
- Type classification
- XP value (15-30 points)
- Completion status

## Data Persistence

- **Auto-hydrates** on app launch from AsyncStorage
- **Detects stale missions** by comparing stored date with today's date
- **Auto-generates new missions** if date mismatch detected
- **Persists after each completion** for real-time updates
- **Storage keys**: `@lockedin/daily_missions`, `@lockedin/daily_missions_date`

## XP System

XP is awarded based on mission type and goal:
- Focus/Deep Work sessions: 20-30 XP
- Active tasks (Workout, Planning): 15-30 XP
- Reflection/Journal: 15-25 XP
- Avoidance tasks (No Social): 20-30 XP

Total daily XP possible: 60-85 XP (varies by goal)

## Design System Integration

Uses app's design system:
- **Colors**: Dark theme with Discipline Blue primary and Electric Cyan accent
- **Typography**: InterTight for headings, Inter for body text
- **Spacing**: 8px base unit, 16px padding standard
- **Rounded**: 8px corner radius for cards
- **Dark mode**: Built-in (no light theme support)

## Performance Considerations

- Mission generation is synchronous (< 1ms)
- AsyncStorage operations are async/await with error handling
- Context updates trigger minimal re-renders (only affected components)
- Card animations use native React Native (Haptics)
- Deterministic IDs prevent duplicate mission rendering

## Future Enhancements

Potential expansions:
- Custom mission creation UI
- Mission scheduling (specific times)
- Streak tracking
- Weekly challenges
- Mission difficulty ratings
- Achievement badges
- Leaderboard integration
