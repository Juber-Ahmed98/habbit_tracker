"use client";

import { create } from "zustand";
import { getDb } from "../db";
import {
  type DailyMetrics,
  type FitnessSession,
  type FitnessSessionType,
} from "../db/schema";
import {
  applyResolution,
  type FitImportCandidate,
  type FitImportResolution,
} from "../fit/import";
import { toLocalDateString } from "../utils/date";
import { useHabitsStore } from "./habits";

// Step 6 — manual-entry-only fitness writes. Step 7 layers Strava ingestion
// on top via the same `createSession` path (dedupe via [source+externalId]).

export type CreateSessionInput = {
  type: FitnessSessionType;
  startedAt: number;
  durationSec: number;
  distanceM?: number;
  name?: string;
  notes?: string;
};

export type CreateBleSessionInput = {
  type: FitnessSessionType;
  startedAt: number;
  durationSec: number;
  hrSeries: Array<{ t: number; bpm: number }>;
  deviceName?: string;
};

export type FitImportDecision = {
  candidate: FitImportCandidate;
  resolution: FitImportResolution;
};

export type FitImportSummary = {
  inserted: number;
  replaced: number;
  merged: number;
  skipped: number;
};

type FitnessStore = {
  // Local UI state — id of the session being viewed/edited.
  draftSessionOpen: boolean;
  setDraftSessionOpen: (open: boolean) => void;

  createManualSession: (input: CreateSessionInput) => Promise<string>;
  createBleSession: (input: CreateBleSessionInput) => Promise<string>;
  commitFitImport: (decisions: FitImportDecision[]) => Promise<FitImportSummary>;
  deleteSession: (id: string) => Promise<void>;

  // dailyMetrics writes
  setStepsForDate: (date: string, steps: number) => Promise<void>;
  addHydrationForDate: (date: string, deltaMl: number) => Promise<void>;
  setHydrationForDate: (date: string, ml: number) => Promise<void>;
};

// Atomic upsert into dailyMetrics that preserves untouched fields.
async function upsertMetric(
  date: string,
  patch: Partial<Omit<DailyMetrics, "date" | "updatedAt">>,
): Promise<void> {
  const db = getDb();
  const existing = await db.dailyMetrics.get(date);
  const next: DailyMetrics = {
    date,
    stepsCount: existing?.stepsCount,
    hydrationMl: existing?.hydrationMl,
    ...patch,
    updatedAt: Date.now(),
  };
  await db.dailyMetrics.put(next);
}

// Tick whichever fitness habit matches a `gym`-type session. Matches §3
// Tier 1: any Strava activity classified as gym auto-ticks the Gym habit;
// we mirror that for manual entry so the UX stays consistent.
async function autoTickGym(session: FitnessSession): Promise<void> {
  if (session.type !== "gym") return;
  const db = getDb();
  // Find a habit named "Gym / Workout" (catalogue) OR any fitness habit in
  // category `fitness-workout`. Either is good enough — user may have renamed.
  const candidate = await db.habits
    .where("tab")
    .equals("fitness")
    .filter(
      (h) => h.category === "fitness-workout" && !h.archivedAt,
    )
    .first();
  if (!candidate) return;
  const dateStr = toLocalDateString(new Date(session.startedAt));
  await useHabitsStore.getState().tickHabit(candidate.id, dateStr);
}

export const useFitnessStore = create<FitnessStore>((set) => ({
  draftSessionOpen: false,
  setDraftSessionOpen: (open) => set({ draftSessionOpen: open }),

  async createManualSession(input) {
    const db = getDb();
    const session: FitnessSession = {
      id: crypto.randomUUID(),
      source: "manual",
      startedAt: input.startedAt,
      durationSec: Math.max(0, Math.round(input.durationSec)),
      type: input.type,
      name: input.name,
      distanceM:
        input.distanceM !== undefined && input.distanceM > 0
          ? input.distanceM
          : undefined,
      notes: input.notes,
    };
    await db.fitnessSessions.put(session);
    await autoTickGym(session);
    return session.id;
  },

  async createBleSession(input) {
    const db = getDb();
    const hr = input.hrSeries;
    const avgHr =
      hr.length > 0
        ? Math.round(hr.reduce((sum, s) => sum + s.bpm, 0) / hr.length)
        : undefined;
    const maxHr =
      hr.length > 0 ? Math.max(...hr.map((s) => s.bpm)) : undefined;
    const session: FitnessSession = {
      id: crypto.randomUUID(),
      source: "ble",
      startedAt: input.startedAt,
      durationSec: Math.max(0, Math.round(input.durationSec)),
      type: input.type,
      name: input.deviceName,
      avgHr,
      maxHr,
      hrSeries: hr,
    };
    await db.fitnessSessions.put(session);
    // Auto-tick the Gym habit per §3 Tier 1 — same rule as Strava/manual.
    if (session.type === "gym") {
      const candidate = await db.habits
        .where("tab")
        .equals("fitness")
        .filter((h) => h.category === "fitness-workout" && !h.archivedAt)
        .first();
      if (candidate) {
        const dateStr = toLocalDateString(new Date(session.startedAt));
        await useHabitsStore.getState().tickHabit(candidate.id, dateStr, "ble");
      }
    }
    return session.id;
  },

  async commitFitImport(decisions) {
    const db = getDb();
    const summary: FitImportSummary = {
      inserted: 0,
      replaced: 0,
      merged: 0,
      skipped: 0,
    };

    // Track which sessions should fire the gym auto-tick. "new" + "replace"
    // both produce a freshly-written gym row from the FIT side, so the tick
    // is appropriate. "merge" leaves the existing row's identity intact —
    // its original write already had a chance to tick (or not).
    const gymTickDates = new Set<string>();

    for (const { candidate, resolution } of decisions) {
      const row = applyResolution(candidate, resolution);
      if (!row) {
        summary.skipped += 1;
        continue;
      }
      // For "replace" the new row carries the conflict's id (set by
      // applyResolution); a `put` cleanly overwrites. For "merge" the row IS
      // the conflict with overlays — same put-by-id semantics.
      await db.fitnessSessions.put(row);

      if (resolution === "new") {
        summary.inserted += 1;
        if (row.type === "gym") {
          gymTickDates.add(toLocalDateString(new Date(row.startedAt)));
        }
      } else if (resolution === "replace") {
        summary.replaced += 1;
        if (row.type === "gym") {
          gymTickDates.add(toLocalDateString(new Date(row.startedAt)));
        }
      } else if (resolution === "merge") {
        summary.merged += 1;
      }
    }

    if (gymTickDates.size > 0) {
      const candidate = await db.habits
        .where("tab")
        .equals("fitness")
        .filter((h) => h.category === "fitness-workout" && !h.archivedAt)
        .first();
      if (candidate) {
        const habits = useHabitsStore.getState();
        for (const date of gymTickDates) {
          // tickHabit is idempotent; if the user already ticked manually
          // the existing row wins. New ticks land with source="fit".
          await habits.tickHabit(candidate.id, date, "fit");
        }
      }
    }

    return summary;
  },

  async deleteSession(id) {
    const db = getDb();
    await db.fitnessSessions.delete(id);
    // Note: we deliberately don't un-tick the Gym habit on session delete —
    // the user may have completed it via other means (manual tick, etc.).
  },

  async setStepsForDate(date, steps) {
    await upsertMetric(date, { stepsCount: Math.max(0, Math.round(steps)) });
  },

  async addHydrationForDate(date, deltaMl) {
    const db = getDb();
    const existing = await db.dailyMetrics.get(date);
    const current = existing?.hydrationMl ?? 0;
    const next = Math.max(0, current + Math.round(deltaMl));
    await upsertMetric(date, { hydrationMl: next });
  },

  async setHydrationForDate(date, ml) {
    await upsertMetric(date, { hydrationMl: Math.max(0, Math.round(ml)) });
  },
}));
