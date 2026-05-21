"use client";

import { getDb } from "@/lib/db";
import {
  type Completion,
  type DailyMetrics,
  type DailyPlan,
  type DeenState,
  type FitnessSession,
  type Habit,
  type MealLog,
  type Settings,
  type SleepLog,
  type StreakSnapshot,
} from "@/lib/db/schema";

// Step 11a — Dexie ↔ Supabase backup blob. One blob per user, full
// snapshot. Versioned at the top level so future schema changes can
// carry a `restore` migration step without bumping the Supabase row.

export const BACKUP_VERSION = 1 as const;

export type BackupTables = {
  habits: Habit[];
  completions: Completion[];
  streakSnapshots: StreakSnapshot[];
  // Single-row tables — null when the user has never seen them (fresh install
  // upload before any hydration). Restore re-creates the row from defaults.
  settings: Settings | null;
  deenState: DeenState | null;
  sleepLogs: SleepLog[];
  mealLogs: MealLog[];
  dailyPlans: DailyPlan[];
  fitnessSessions: FitnessSession[];
  dailyMetrics: DailyMetrics[];
};

export type BackupBlob = {
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  tables: BackupTables;
};

export async function serializeBackup(): Promise<BackupBlob> {
  const db = getDb();
  const [
    habits,
    completions,
    streakSnapshots,
    settings,
    deenState,
    sleepLogs,
    mealLogs,
    dailyPlans,
    fitnessSessions,
    dailyMetrics,
  ] = await Promise.all([
    db.habits.toArray(),
    db.completions.toArray(),
    db.streakSnapshots.toArray(),
    db.settings.get("singleton"),
    db.deenState.get("singleton"),
    db.sleepLogs.toArray(),
    db.mealLogs.toArray(),
    db.dailyPlans.toArray(),
    db.fitnessSessions.toArray(),
    db.dailyMetrics.toArray(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tables: {
      habits,
      completions,
      streakSnapshots,
      settings: settings ?? null,
      deenState: deenState ?? null,
      sleepLogs,
      mealLogs,
      dailyPlans,
      fitnessSessions,
      dailyMetrics,
    },
  };
}

// Quick stats for the UI ("12 habits, 480 completions, …"). Pure derivation
// from a blob so the BackupCard can render before any commit.
export type BackupSummary = {
  habits: number;
  completions: number;
  sessions: number;
};

export function summariseBackup(blob: BackupBlob): BackupSummary {
  return {
    habits: blob.tables.habits.length,
    completions: blob.tables.completions.length,
    sessions: blob.tables.fitnessSessions.length,
  };
}
