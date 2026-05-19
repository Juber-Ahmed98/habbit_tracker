import Dexie, { type Table } from "dexie";
import {
  DEFAULT_SETTINGS,
  type Completion,
  type Habit,
  type Settings,
  type StreakSnapshot,
} from "./schema";

class HabitTrackerDB extends Dexie {
  habits!: Table<Habit, string>;
  completions!: Table<Completion, string>;
  streakSnapshots!: Table<StreakSnapshot, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("habit-tracker");

    // v1 — initial schema. Bump the version number on every breaking change
    // and add a new .version(N).stores(...).upgrade(...) block per §6.
    this.version(1).stores({
      habits: "id, tab, order, archivedAt",
      completions: "id, habitId, date, [habitId+date]",
      streakSnapshots: "habitId",
      settings: "id",
    });
  }
}

let _db: HabitTrackerDB | null = null;

// Lazy singleton so importing this module on the server (Next bundling,
// type checks) doesn't try to open IndexedDB at module load.
export function getDb(): HabitTrackerDB {
  if (typeof window === "undefined") {
    throw new Error("getDb() called on the server; Dexie is browser-only");
  }
  if (!_db) {
    _db = new HabitTrackerDB();
  }
  return _db;
}

// First-run seed: ensure a Settings row exists. Idempotent.
export async function ensureSettingsSeed(): Promise<Settings> {
  const db = getDb();
  const existing = await db.settings.get("singleton");
  if (existing) return existing;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
