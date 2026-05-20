import Dexie, { type Table } from "dexie";
import {
  DEFAULT_DEEN_STATE,
  DEFAULT_SETTINGS,
  type Completion,
  type DailyPlan,
  type DeenState,
  type Habit,
  type MealLog,
  type Settings,
  type SleepLog,
  type StreakSnapshot,
} from "./schema";

class HabitTrackerDB extends Dexie {
  habits!: Table<Habit, string>;
  completions!: Table<Completion, string>;
  streakSnapshots!: Table<StreakSnapshot, string>;
  settings!: Table<Settings, string>;
  // Step 3 additions
  deenState!: Table<DeenState, string>;
  sleepLogs!: Table<SleepLog, string>;
  mealLogs!: Table<MealLog, string>;
  dailyPlans!: Table<DailyPlan, string>;

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

    // v2 — Step 3 auxiliary tables + a `category` index on habits so each
    // tab can fetch its structural rows by (tab+category) cheaply.
    // Dexie populates new tables empty; no .upgrade() needed.
    this.version(2).stores({
      habits: "id, tab, order, archivedAt, category",
      completions: "id, habitId, date, [habitId+date]",
      streakSnapshots: "habitId",
      settings: "id",
      deenState: "id",
      sleepLogs: "date",
      mealLogs: "date",
      dailyPlans: "date",
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
// Also backfills any fields added in later versions so existing v1 users
// don't see `undefined` for `catalogueSeeded` after the v2 bump.
export async function ensureSettingsSeed(): Promise<Settings> {
  const db = getDb();
  const existing = await db.settings.get("singleton");
  if (existing) {
    const backfilled: Settings = { ...DEFAULT_SETTINGS, ...existing };
    if (
      backfilled.catalogueSeeded === undefined ||
      backfilled.hydrationMinimumMl === undefined
    ) {
      await db.settings.put(backfilled);
    }
    return backfilled;
  }
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

// Same idea for DeenState — single-row, lazily seeded. Also backfills
// any newly-added fields so older v2 rows pick them up on next read.
export async function ensureDeenStateSeed(): Promise<DeenState> {
  const db = getDb();
  const existing = await db.deenState.get("singleton");
  if (existing) {
    const merged: DeenState = {
      ...DEFAULT_DEEN_STATE,
      ...existing,
      quran: { ...DEFAULT_DEEN_STATE.quran, ...existing.quran },
      hifdh: { ...DEFAULT_DEEN_STATE.hifdh, ...existing.hifdh },
      hifdhNotesByDate:
        existing.hifdhNotesByDate ?? DEFAULT_DEEN_STATE.hifdhNotesByDate,
      pagesReadByDate:
        existing.pagesReadByDate ?? DEFAULT_DEEN_STATE.pagesReadByDate,
    };
    return merged;
  }
  await db.deenState.put(DEFAULT_DEEN_STATE);
  return DEFAULT_DEEN_STATE;
}
