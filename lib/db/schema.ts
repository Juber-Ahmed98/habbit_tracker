// Domain types — sourced from habit-tracker-spec.md §6.
// Settings is extended (vs §6) with `hydrationMinimumMl` to support
// the "minimum 2000ml, ideal 2500ml" goal model agreed in Step 2.

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
  | "auto";

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
};
