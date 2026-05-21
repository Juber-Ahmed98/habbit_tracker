# Habit Tracker PWA — Build Specification

> **Purpose:** This is the source-of-truth build prompt for Claude Code. Implement it as a Progressive Web App deployed to Vercel, optimised for a Samsung Galaxy S24 Ultra installed from Chrome.

> **Implementation status note (read first):** This spec is the original
> intent. Shipped state, schema versions, and any decisions made during the
> build live in code — check `git log`, `CLAUDE.md`, and `lib/db/schema.ts`
> for the current truth. Where the build deliberately diverges from this
> document, the divergence is called out inline below (search for
> "**Deviation:**").

---

## 0. High-Level Brief

A personal habit tracker spanning five life domains (Dashboard, Fitness, Work, Deen, Lifestyle). It must:

- Feel native on Android — installable, fullscreen, haptic, offline-capable, push-notification-aware.
- Pull live and historical data from a **Garmin** watch into the Fitness tab via a tiered integration strategy.
- Be **local-first**: usable without an account; cloud sync is opt-in.
- Reward completion with a visual + haptic micro-interaction (hollow neutral → solid yellow with vibration).

---

## 1. Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Server components where appropriate; TypeScript strict mode |
| Styling | Tailwind CSS | Custom theme tokens for the palette in §4 |
| PWA | `@serwist/next` (or `next-pwa`) | Service worker, manifest, install prompts |
| Local storage | Dexie.js (IndexedDB) | All habit data lives here first |
| Cloud sync (optional) | Supabase (Postgres + Auth) | Behind a Settings toggle; not required on first launch |
| State | Zustand | One store per domain (habits, fitness, settings) |
| Forms | React Hook Form + Zod | Schema validation reused for Dexie |
| Charts | Recharts | Streak heatmaps, weekly bars, HR graphs |
| Dates | date-fns | Avoid moment.js |
| Icons | Lucide React | Consistent stroke width |
| Animations | Framer Motion | For the "fill yellow" reward and tab transitions |
| Garmin/Strava OAuth | Vercel API routes (Node runtime) | Holds client secrets server-side |
| FIT parsing | `fit-file-parser` | Client-side parsing of uploaded .fit files |
| Live BLE | Web Bluetooth API | Native browser API, no library. Android Chrome only — iOS Safari, Firefox, and Brave are gated to an unsupported view |
| Deployment | Vercel | Set OAuth secrets as env vars in the Vercel dashboard |

---

## 2. Project Structure

```
/app
  /(tabs)
    /dashboard/page.tsx
    /fitness/page.tsx
    /work/page.tsx
    /deen/page.tsx
    /lifestyle/page.tsx
  /settings/page.tsx
  /onboarding/page.tsx
  /api/strava/callback/route.ts   # OAuth code exchange
  /api/strava/refresh/route.ts    # Token refresh
  layout.tsx                       # Bottom nav, theme provider
/components
  /ui              # Button, Card, Ring, Toggle, etc.
  /habits          # HabitCard, HabitGrid, StreakFlame
  /fitness         # GarminConnect, LiveHRMonitor, FitFileImporter
/lib
  /db              # Dexie schema, migrations, hooks
  /garmin          # Strava client, BLE client, FIT parser
  /streaks         # Streak calculation, freeze-day logic
  /haptics         # Vibration helpers
  /notifications   # Push registration, reminder scheduling
/public
  manifest.json
  icons/           # 192, 512, maskable, monochrome
```

---

## 3. Garmin Integration Strategy

Implement these in order. Each tier is independently useful — ship Tier 1 first, layer the others in.

### Tier 1 — Strava OAuth (primary for activity data)

Garmin Connect already auto-syncs activities to Strava if the user links them in the Garmin app once. Strava's API is free, public, and uses standard OAuth 2.0.

- **Flow:** Settings → "Connect Strava" → redirect to `https://www.strava.com/oauth/authorize` with scope `read,activity:read_all` → Vercel API route exchanges code for tokens. **Deviation from original spec:** tokens are *not* persisted in IndexedDB. They live only in an HMAC-SHA256-signed httpOnly cookie set by the server route, so the client never sees them — this is the only way to comply with §14 "never expose secrets to the client" while keeping the auth fully serverless. The athlete id is mirrored into Settings.strava in Dexie so the UI can render connection state without a network round-trip.
- **Data pulled:** Distance, duration, type, calories, average/max HR, elevation, start time, GPS polyline for each activity.
- **Sync cadence:** On app open (debounced — see `AppHydrator`), plus a manual "Refresh" button. Optionally subscribe to Strava webhooks via another Vercel API route for push updates.
- **Endpoint:** `GET /api/v3/athlete/activities?after={lastSyncEpoch}` paginated.
- **Mapping:** Strava activity → local `FitnessSession` record; if a "Gym / Workout" habit exists for that day, auto-tick it.

### Tier 2 — Web Bluetooth (live data during workouts)

Modern Garmin watches (Forerunner, Fenix, Venu, Epix, Instinct) can broadcast heart rate over BLE in "Broadcast Heart Rate" mode. Chrome on Android supports the Web Bluetooth API.

- **Use case:** A "Live Workout" screen inside Fitness that connects to the watch, streams HR in real time, plots it on a sparkline, and logs the session to IndexedDB when the user taps Stop.
- **API:** `navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })` → GATT → `0x2A37` characteristic → `startNotifications`.
- **Caveat:** Web Bluetooth requires the PWA be served over HTTPS (Vercel gives this for free) and the user must enable broadcast mode on the watch each session (Activity menu → Options → Broadcast Heart Rate). On Android, the system Location toggle must also be on (Android gates BLE scanning behind Location even when the page doesn't read location). **Browser support is narrow:** Android Chrome works; iOS Safari, Firefox, and Brave do not — Brave's stricter permission sandbox blocks the API even on platforms where Chromium normally supports it. The live screen renders an "unsupported" fallback in those cases.
- **UI:** Big BPM number, 60-second rolling chart, zone indicator (Z1–Z5 based on user-set max HR), elapsed timer.

### Tier 3 — Manual FIT file upload (fallback)

For workouts that didn't sync to Strava, or for richer per-second data:

- Settings → Fitness → "Import .FIT file" → file picker.
- Parse client-side with `fit-file-parser`.
- Extract records, sessions, laps; store in IndexedDB.
- Show a summary diff before saving ("This activity overlaps an existing one — merge / replace / cancel?").

### Tier 4 — Garmin Health API (long-term)

Apply in parallel at `developer.garmin.com/gc-developer-program/health-api/`. Approval can take weeks. Once granted:

- OAuth flow analogous to Strava.
- Data: daily steps, sleep stages, stress, body battery, resting HR, VO2 max, training load.
- Swap manual hydration/step entry for live Garmin values.
- Leave the UI hooks in place from day one so this is a drop-in swap, not a rebuild.

### Data model for fitness sync

```ts
type FitnessSession = {
  id: string;
  source: 'strava' | 'garmin' | 'ble' | 'fit' | 'manual';
  externalId?: string;            // dedupe key
  startedAt: number;              // epoch ms
  durationSec: number;
  type: 'run' | 'ride' | 'gym' | 'walk' | 'swim' | 'other';
  distanceM?: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  hrSeries?: Array<{ t: number; bpm: number }>;
  raw?: unknown;                  // original payload for debugging
};
```

Always dedupe on `(source, externalId)` when present, otherwise `(startedAt ± 60s, durationSec ± 60s)`.

---

## 4. Visual Theme

### Palette (CSS variables, both modes)

```css
:root[data-theme='light'] {
  --bg:               #F4F1EA;  /* Warm Sand */
  --surface:          #FFFFFF;
  --surface-alt:      #EDE8DD;
  --text:             #22252A;
  --text-muted:       #6B6357;
  --border:           #D9D2C2;
  --accent:           #FFC83B;  /* Energetic Yellow — completed state */
  --accent-ink:       #2A1F00;
  --neutral-outline:  #8D7A68;  /* Earthy Brown — incomplete state */
  --success:          #5C8A4E;
  --danger:           #B85C4E;
  --streak:           #F07A2C;  /* Streak flame */
}

:root[data-theme='dark'] {
  --bg:               #22252A;  /* Deep Charcoal */
  --surface:          #2C3038;
  --surface-alt:      #353A44;
  --text:             #F4F1EA;
  --text-muted:       #A8A095;
  --border:           #3F4550;
  --accent:           #FFC83B;
  --accent-ink:       #2A1F00;
  --neutral-outline:  #8D7A68;
  --success:          #7AB36A;
  --danger:           #D67B6E;
  --streak:           #FF9145;
}
```

- Auto-follow `prefers-color-scheme`; manual override in Settings.
- All interactive surfaces are **Card** components: 16px radius, 1px border in `--border`, 16px internal padding, subtle elevation only on press.
- Typography: system font stack (`-apple-system, "Segoe UI", Roboto, Inter, sans-serif`). Sizes: 28/20/16/14/12. Line-height 1.4.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32.

### The completion micro-interaction (precise spec)

1. Initial state: card has 2px **dashed** border in `--neutral-outline`, transparent fill, text in `--text-muted`.
2. On tap:
   - `navigator.vibrate(12)` fires immediately.
   - Border solidifies and animates to `--accent` (150ms ease-out).
   - Background fills `--accent` from the tap point outward (radial reveal, 280ms).
   - Text colour transitions to `--accent-ink`.
   - A checkmark icon scales from 0 → 1 with a slight overshoot (Framer spring: stiffness 400, damping 18).
3. Long-press (500ms) opens an edit sheet (rename, set time, delete, view streak history).

### Streak flame

When `currentStreak >= 3`, render a 🔥 icon next to the habit name with a slow pulse (1.0 → 1.08 → 1.0 over 2s, `--streak` colour). At 7+ days, the flame is filled; at 30+, it has a subtle glow shadow.

---

## 5. Navigation Architecture (Bottom Tabs)

5 tabs, fixed bottom, 56px tall, safe-area-inset-bottom respected. Active tab: icon + label in `--accent`. Inactive: icon only in `--text-muted`.

### 5.1 Dashboard

**Hero — week strip**
- 7 day chips, Mon–Sun, current week.
- Each chip: weekday letter on top, date number below, status dot at bottom.
  - All habits done → solid yellow dot.
  - Some done → half-filled dot.
  - None done → outline dot.
  - Future days → grey dot.
- Tap a day → drill-down modal showing that day's habits and completion log.
- Swipe horizontally → previous/next weeks.

**Daily progress ring**
- Circular SVG ring, 160px diameter, 12px stroke.
- Shows `completed / total` for today, with the count centred ("5 / 12 Done").
- Stroke colour transitions from `--neutral-outline` → `--accent` as it fills.

**Highlights feed**
- Top 3 urgent / time-sensitive habits across all tabs.
- Ranking algorithm: weight by `(targetTime - now)` if scheduled, plus `streakAtRisk` (a 4+ day streak that hasn't been hit today bumps a habit to top).
- Each row: icon, habit name, tab badge, quick-tick button on the right.

**Insights strip (new)**
- Horizontal scroll of mini-cards: "Best streak this month", "Completion rate this week", "Top tab", "Sessions logged from Garmin".
- Tappable → full insights view.

### 5.2 Fitness

**Header strip**
- Workout streak counter (days).
- Last activity preview ("Run · 5.2km · yesterday") pulled from Strava.
- "Live Workout" button → opens the Web Bluetooth HR monitor (§3 Tier 2).

**Habit grid**
- Gym / Workout — toggle, optionally with a timer.
- Steps — progress bar against daily goal (default 10k), filled from Garmin/Strava when available, manual `+` button otherwise.
- Hydration — tap-to-add 250ml chips, with a glass-fill visual.
- Custom fitness habits — user-defined.

**Recent activities list**
- Last 7 days of synced sessions.
- Each row: icon by type, name, duration, distance, avg HR.
- Tap → detail view with HR plot (Recharts area chart over `hrSeries`) and map polyline if present.

**Garmin sync status card**
- Green dot if Strava connected and synced in the last 24h.
- Amber if stale (>24h).
- Red if disconnected.
- Tap → opens Settings → Fitness.

### 5.3 Work

- Pomodoro timer card at the top: 25/5 default, configurable, with start/pause/skip. Plays a soft chime via Web Audio when the interval ends. Logs completed sessions as a habit tick.
- "Inbox Zero" — simple toggle.
- "Skill building / reading" — time-tracked with a stopwatch; can also accept a manual minutes entry.
- "Daily planning" — toggle, with an optional text field for tomorrow's top 3.

Layout intentionally sparse to avoid distraction: single column, lots of whitespace.

### 5.4 Deen

Spacious, serene. Generous vertical padding. Larger card radius (20px). Subtle parchment texture overlay at 4% opacity on cards (light mode only).

**Quran Reading (Tilawah)**
- Card showing current Juz, Surah, Ayah.
- "Log pages read today" — number stepper.
- Quick navigator: dropdown of all 30 Juz / 114 Surahs (include a JSON dataset of Surah names and ayah counts).
- Mini stat: "Last opened: 14 hours ago" in `--text-muted`.

**Quran Memorization (Hifdh)**
- Dual-state tracker, two sub-cards inside one container:
  - **New memorization:** input verses/pages today, with a "Mark surah complete" action.
  - **Revision (Murajah):** checkbox for "Revised today" + a list of suggested surahs to revise (based on what hasn't been revised in the longest time).
- Visual: a small "memorisation map" showing which Juz are in progress, complete, or untouched.

### 5.5 Lifestyle

Categorised list with section headers and small icons.

- **Skincare:** Morning routine, Evening routine.
- **Supplements:** Morning vitamins, Evening minerals/meds. Each can hold a list of named items (Vitamin D, Omega-3, etc.) the user defines once in Settings.
- **Sleep:** Optional time-in/time-out logger; "Wind-down by 10pm" toggle. If linked, pulls sleep duration from Garmin Health API when available.
- **Diet:** Clean eating toggle, no-sugar toggle, optional meal log.

All sub-habits use the same HabitCard component so the visual language is consistent across tabs.

---

## 6. Data Model

```ts
type Habit = {
  id: string;
  tab: 'fitness' | 'work' | 'deen' | 'lifestyle';
  category?: string;             // e.g. 'skincare', 'supplements'
  name: string;
  icon: string;                  // lucide icon name
  type: 'toggle' | 'counter' | 'timer' | 'duration';
  target?: number;               // e.g. 10000 steps, 8 cups, 25 minutes
  unit?: string;                 // 'steps', 'ml', 'min'
  schedule: {
    days: number[];              // 0–6, Sun–Sat
    timeOfDay?: string;          // 'HH:mm' optional reminder
  };
  createdAt: number;
  archivedAt?: number;
  order: number;                 // for manual reordering
};

type Completion = {
  id: string;
  habitId: string;
  date: string;                  // 'YYYY-MM-DD' local
  value?: number;                // for counter/timer
  completedAt: number;           // epoch
  source: 'manual' | 'garmin' | 'strava' | 'ble' | 'auto';
};

type StreakSnapshot = {
  habitId: string;
  current: number;
  longest: number;
  lastCompletedDate: string;
};

type Settings = {
  theme: 'system' | 'light' | 'dark';
  startOfWeek: 0 | 1;
  units: 'metric' | 'imperial';
  notificationsEnabled: boolean;
  cloudSyncEnabled: boolean;
  strava?: { connected: boolean; athleteId?: string; lastSyncAt?: number };
  garmin?: { connected: boolean; lastSyncAt?: number };
  maxHr?: number;                // for BLE zone calc
  stepGoal: number;
  hydrationGoalMl: number;
};
```

Dexie schema bumps on every breaking change; write migrations.

> **Deviation:** the implementation has extended these shapes — for example
> `Settings` carries `enabledTabs`, `displayName`, `onboardingCompletedAt`,
> `hydrationMinimumMl`, and `catalogueSeeded`; `FitnessSession.source`
> includes `"manual"` and `"fit"`; `Completion.source` adds `"fit"` and
> `"freeze"`. Treat `lib/db/schema.ts` as authoritative.

---

## 7. Streak Logic

- `currentStreak`: number of consecutive scheduled days up to and including today (or yesterday if today's window hasn't yet passed) where the habit was completed.
- Skipped days that are **not** scheduled do not break the streak.
- A "freeze day" feature (one per habit per week) lets a missed day not break the streak — surface this as a UX option, not automatic.
- Recompute on every write; cache `StreakSnapshot` per habit.

---

## 8. Notifications & Reminders

- Use the Web Push API + a service worker.
- Permission requested on first visit to Settings → Notifications, not on app launch.
- Scheduling is **local** (service worker `setTimeout` won't survive — use the `Notification Triggers` API where available, otherwise re-register on each app open):
  - Per-habit reminder at `schedule.timeOfDay`.
  - Evening summary at 21:00 if any scheduled habits remain unticked.
  - Streak-at-risk nudge at 20:00 if a streak of 3+ would break today.
- Each notification deep-links to the relevant tab.

> **Deviation:** notifications were deferred out of Step 5 — they ride
> alongside Supabase cloud sync in Step 11 because reliable push needs a
> real backend (web-push private key, subscription storage). Step 5's
> Settings → Notifications toggle is shipped as a disabled placeholder.

---

## 9. PWA / Mobile Optimisations (Galaxy S24 Ultra)

- `manifest.json` with `display: standalone`, `theme_color: #22252A`, `background_color: #F4F1EA`, full icon set including 192, 512, maskable, and monochrome for the Android themed-icon system.
- `viewport-fit=cover` and CSS `env(safe-area-inset-*)` to respect the S24's punch-hole and gesture bar.
- Pull-to-refresh on each tab triggers a sync (Strava on Fitness, otherwise a soft reload).
- Haptics via `navigator.vibrate` — short tap (12ms) for completion, double tap (8, 40, 8) for milestones (7-day streak hit, etc.).
- Aggressive caching: app shell precached, API responses stale-while-revalidate.
- Background sync via service worker for queueing offline ticks.
- Lazy-load tabs (Next.js dynamic imports) to keep first-paint fast.
- Test target: Lighthouse PWA score ≥ 95, FCP < 1.5s on a throttled 4G profile.

---

## 10. Onboarding (first launch)

A 4-step flow, skippable:

1. Welcome — name + which tabs to enable (all five by default).
2. Suggested habits — picks 2–3 per enabled tab; user can untick.
3. Goals — step goal, hydration goal, max HR (for BLE zones).
4. Connections — optionally connect Strava and enable notifications now or later.

Persist to `Settings` and seed `Habit` records.

---

## 11. Settings Page

- Profile (name, avatar — local only by default).
- Theme (system / light / dark).
- Units (metric / imperial).
- Start of week (Sun / Mon).
- Notifications (master toggle + per-habit overrides).
- Cloud sync (Supabase login — optional).
- **Fitness sources:** Strava connect/disconnect, FIT file import, Web Bluetooth test, Garmin Health API (when approved).
- Data — export all (JSON download), import JSON, wipe local data.
- About — version, build hash, link to source.

---

## 12. Accessibility

- All interactive elements ≥ 44×44 px tap target.
- Colour contrast ≥ AA in both themes (verify the yellow-on-charcoal pairing for the active accent — may need a slightly darker yellow variant in dark mode if it fails).
- All icons have aria-labels.
- Respect `prefers-reduced-motion`: replace radial fills with simple colour transitions, disable the flame pulse.
- Screen-reader announcements on completion ("Habit completed. Current streak: 5 days.").

---

## 13. Build Order (suggested)

1. **Scaffold:** Next.js + Tailwind + theme tokens + bottom tab shell + PWA manifest. Verify install on the S24.
2. **Data layer:** Dexie schema, Zustand stores, HabitCard component with the full completion micro-interaction.
3. **Dashboard, Work, Lifestyle, Deen** with manual ticking only.
4. **Streaks + Insights.**
5. **Onboarding + Settings.** *(Notifications were originally scoped here but deferred to step 11 — see §8.)*
6. **Fitness tab — manual entry first.**
7. **Strava OAuth** via Vercel API route. Sync activities, auto-tick gym habit.
8. **Web Bluetooth live HR monitor.**
9. **FIT file import.**
10. **Polish:** Framer Motion transitions, haptic tuning, dark-mode contrast pass, Lighthouse audit.
11. **(Later)** Supabase cloud sync; Garmin Health API once approved; web-push notifications.

---

## 14. Environment Variables (Vercel)

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=https://<your-site>.vercel.app/api/strava/callback
STRAVA_COOKIE_SECRET=        # HMAC key for the signed session cookie (32+ bytes)
SUPABASE_URL=
SUPABASE_ANON_KEY=
# Garmin (when approved)
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
```

Never expose secrets to the client — all token exchanges happen in Vercel API routes (Node runtime). Strava one-app-per-callback-domain means you need a separate Strava app registration for local dev (`http://localhost:3000/api/strava/callback`) and for the Vercel deployment.

---

## 15. Non-goals (for v1)

- Social features, sharing, friends.
- Apple Health / iOS support.
- Multi-user accounts on the same device.
- AI suggestions.

Keep the scope tight; these can come later.
