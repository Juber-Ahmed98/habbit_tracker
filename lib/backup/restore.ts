"use client";

import { getDb } from "@/lib/db";
import { type BackupBlob, BACKUP_VERSION } from "./serialize";

// Restore is destructive: clear every Dexie table involved, then bulk-put
// from the blob. Caller is responsible for confirming with the user *before*
// invoking this — there's no undo. After this resolves, the page should be
// reloaded so Zustand stores re-hydrate cleanly from the new state.

export class BackupVersionError extends Error {
  constructor(found: unknown) {
    super(
      `Unsupported backup version: ${String(found)} (expected ${BACKUP_VERSION})`,
    );
    this.name = "BackupVersionError";
  }
}

export async function restoreBackup(blob: BackupBlob): Promise<void> {
  if (blob.version !== BACKUP_VERSION) {
    throw new BackupVersionError(blob.version);
  }
  const db = getDb();
  const {
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
  } = blob.tables;

  // Single transaction across every restored table so a mid-restore crash
  // leaves the DB either fully old or fully new — never half-restored.
  await db.transaction(
    "rw",
    [
      db.habits,
      db.completions,
      db.streakSnapshots,
      db.settings,
      db.deenState,
      db.sleepLogs,
      db.mealLogs,
      db.dailyPlans,
      db.fitnessSessions,
      db.dailyMetrics,
    ],
    async () => {
      await Promise.all([
        db.habits.clear(),
        db.completions.clear(),
        db.streakSnapshots.clear(),
        db.settings.clear(),
        db.deenState.clear(),
        db.sleepLogs.clear(),
        db.mealLogs.clear(),
        db.dailyPlans.clear(),
        db.fitnessSessions.clear(),
        db.dailyMetrics.clear(),
      ]);
      await Promise.all([
        habits.length ? db.habits.bulkPut(habits) : Promise.resolve(),
        completions.length
          ? db.completions.bulkPut(completions)
          : Promise.resolve(),
        streakSnapshots.length
          ? db.streakSnapshots.bulkPut(streakSnapshots)
          : Promise.resolve(),
        settings ? db.settings.put(settings) : Promise.resolve(),
        deenState ? db.deenState.put(deenState) : Promise.resolve(),
        sleepLogs.length
          ? db.sleepLogs.bulkPut(sleepLogs)
          : Promise.resolve(),
        mealLogs.length
          ? db.mealLogs.bulkPut(mealLogs)
          : Promise.resolve(),
        dailyPlans.length
          ? db.dailyPlans.bulkPut(dailyPlans)
          : Promise.resolve(),
        fitnessSessions.length
          ? db.fitnessSessions.bulkPut(fitnessSessions)
          : Promise.resolve(),
        dailyMetrics.length
          ? db.dailyMetrics.bulkPut(dailyMetrics)
          : Promise.resolve(),
      ]);
    },
  );
}
