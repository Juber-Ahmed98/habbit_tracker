// Domain types — sourced from habit-tracker-spec.md §6.
// Settings is extended (vs §6) with `hydrationMinimumMl` (Step 2) and
// `catalogueSeeded` (Step 3, marks the one-time structural habit seed).

export type HabitTab = "fitness" | "work" | "deen" | "lifestyle";
export type HabitType = "toggle" | "counter" | "timer" | "duration";

export type Habit = {
  id: string;
  tab: HabitTab;
  category?: string;
  name: string;
  icon: string;
  type: HabitType;
  target?: number;
  unit?: string;
  schedule: {
    days: number[]; // 0–6, Sun–Sat
    timeOfDay?: string; // 'HH:mm'
  };
  createdAt: number;
  archivedAt?: number;
  order: number;
};

export type CompletionSource =
  | "manual"
  | "garmin"
  | "strava"
  | "ble"
  | "fit"     // Step 9 — gym auto-tick on a FIT-imported gym session.
  | "auto"
  | "freeze"; // §7 freeze day — counts as done for streak purposes but
              //          tagged so we can enforce one-per-week & render distinctly.

export type Completion = {
  id: string;
  habitId: string;
  date: string; // 'YYYY-MM-DD' local
  value?: number;
  completedAt: number;
  source: CompletionSource;
};

export type StreakSnapshot = {
  habitId: string;
  current: number;
  longest: number;
  lastCompletedDate: string;
};

export type ThemeChoice = "system" | "light" | "dark";
export type UnitSystem = "metric" | "imperial";

// All five tab routes. Dashboard is the home fallback — UI keeps it locked on.
export type TabKey = "dashboard" | "fitness" | "work" | "deen" | "lifestyle";

export type EnabledTabs = Record<TabKey, boolean>;

export type Settings = {
  id: "singleton"; // single-row table; fixed key
  theme: ThemeChoice;
  startOfWeek: 0 | 1;
  units: UnitSystem;
  notificationsEnabled: boolean;
  cloudSyncEnabled: boolean;
  strava?: { connected: boolean; athleteId?: string; lastSyncAt?: number };
  garmin?: { connected: boolean; lastSyncAt?: number };
  maxHr?: number;
  stepGoal: number;
  hydrationGoalMl: number; // ideal daily goal
  hydrationMinimumMl: number; // minimum acceptable daily intake
  catalogueSeeded: boolean; // Step 3: one-time structural seed flag
  // Step 5 additions ---------------------------------------------------------
  displayName?: string;             // Optional name captured in onboarding.
  enabledTabs: EnabledTabs;         // Per-tab visibility. Dashboard always true.
  onboardingCompletedAt?: number;   // Epoch ms; presence gates /onboarding redirect.
  // Step 11a addition --------------------------------------------------------
  lastBackupAt?: number;            // Epoch ms; written by lib/backup/sync.
};

export const DEFAULT_ENABLED_TABS: EnabledTabs = {
  dashboard: true,
  fitness: true,
  work: true,
  deen: true,
  lifestyle: true,
};

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  theme: "system",
  startOfWeek: 1,
  units: "metric",
  notificationsEnabled: false,
  cloudSyncEnabled: false,
  stepGoal: 10000,
  hydrationGoalMl: 2500,
  hydrationMinimumMl: 2000,
  catalogueSeeded: false,
  enabledTabs: DEFAULT_ENABLED_TABS,
};

// ---------------------------------------------------------------------------
// Step 3 auxiliary state. These live alongside Habit/Completion in Dexie but
// aren't habit ticks — they're free-form per-day or per-domain blobs.
// ---------------------------------------------------------------------------

// Deen tab — Quran reading position + Hifdh map. Single-row table.
export type DeenState = {
  id: "singleton";
  quran: {
    currentJuz: number;       // 1–30
    currentSurah: number;     // 1–114
    currentAyah: number;      // within currentSurah
    lastOpenedAt?: number;    // epoch ms
  };
  hifdh: {
    // Per-juz memorisation status. Missing keys = "untouched".
    juzStatus: Partial<Record<number, "in-progress" | "complete">>;
  };
  // Free-text notes captured for "what did I memorise today", keyed by
  // YYYY-MM-DD. Kept on the singleton for now — easy to denormalise later.
  hifdhNotesByDate: Record<string, string>;
  // Pages of tilawah read each day. Per-date counter, manually stepped.
  pagesReadByDate: Record<string, number>;
};

export const DEFAULT_DEEN_STATE: DeenState = {
  id: "singleton",
  quran: { currentJuz: 1, currentSurah: 1, currentAyah: 1 },
  hifdh: { juzStatus: {} },
  hifdhNotesByDate: {},
  pagesReadByDate: {},
};

// Lifestyle tab — sleep log per date.
export type SleepLog = {
  date: string;        // 'YYYY-MM-DD' local — primary key
  bedTime?: string;    // 'HH:mm' the night previous to `date`
  wakeTime?: string;   // 'HH:mm' on the morning of `date`
  updatedAt: number;
};

// Lifestyle tab — meal log per date (free text).
export type MealLog = {
  date: string;        // 'YYYY-MM-DD' local — primary key
  text: string;
  updatedAt: number;
};

// Work tab — daily planning's optional "tomorrow's top 3" text.
export type DailyPlan = {
  date: string;        // 'YYYY-MM-DD' local — primary key (the day the plan is FOR)
  text: string;
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// Step 6 — Fitness tab. Two new shapes:
//   * FitnessSession  — a discrete workout/activity record. Manual entry in
//                       Step 6; later filled from Strava / BLE / FIT files.
//   * DailyMetrics    — date-keyed counters for steps + hydration. These are
//                       metrics not habits, so they live outside Habit rows.
// ---------------------------------------------------------------------------

export type FitnessSessionSource =
  | "manual"   // Step 6 — user typed it in
  | "strava"   // Step 7
  | "ble"      // Step 8 (live HR monitor stop)
  | "fit"      // Step 9
  | "garmin";  // Step 11 (Garmin Health API)

export type FitnessSessionType =
  | "run"
  | "ride"
  | "gym"
  | "walk"
  | "swim"
  | "other";

export type FitnessSession = {
  id: string;
  source: FitnessSessionSource;
  externalId?: string;             // dedupe key when source provides one
  startedAt: number;               // epoch ms
  durationSec: number;
  type: FitnessSessionType;
  name?: string;                   // optional human label, e.g. "Morning run"
  distanceM?: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  notes?: string;                  // manual-entry free text
  hrSeries?: Array<{ t: number; bpm: number }>; // populated by BLE/Strava/FIT
  raw?: unknown;                   // original payload, debugging
};

// Helper local-date key for sessions when we group by day for UI.
export function fitnessSessionDateKey(s: FitnessSession): string {
  const d = new Date(s.startedAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Date-keyed counters. Bespoke widgets in the Fitness tab (StepsCard,
// HydrationCard) read/write directly via the fitness store. Streak machinery
// deliberately doesn't touch this — they're metrics, not habits.
export type DailyMetrics = {
  date: string;          // 'YYYY-MM-DD' local — primary key
  stepsCount?: number;   // absolute total for the day
  hydrationMl?: number;  // accumulated ml drunk
  updatedAt: number;
};
