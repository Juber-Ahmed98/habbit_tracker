"use client";

import { getDb } from "@/lib/db";
import { type FitnessSession } from "@/lib/db/schema";
import { mapFitToSessions } from "./map";
import { parseFitFile } from "./parse";

// Step 9 — orchestrate parse → map → overlap-lookup so the UI can show a
// per-candidate conflict prompt before writing anything. Writes themselves
// live in the fitness store so we don't fork the auto-tick-gym path.

// Spec §6: "dedupe on (source, externalId) when present, otherwise
// (startedAt ± 60s, durationSec ± 60s)". For FIT we set a stable externalId
// for self-dedupe across re-imports of the same file, AND we still scan the
// startedAt window so we catch overlaps with Strava/BLE rows for the same
// physical activity.
const OVERLAP_WINDOW_MS = 60_000;
const OVERLAP_DURATION_TOLERANCE_SEC = 60;

export type FitImportResolution = "new" | "replace" | "merge" | "skip";

export type FitImportCandidate = {
  session: FitnessSession;       // the freshly-parsed row
  conflict?: FitnessSession;     // an existing overlapping row, if any
  defaultResolution: FitImportResolution;
};

export type FitImportPreview = {
  fileName: string;
  candidates: FitImportCandidate[];
};

async function findOverlap(
  candidate: FitnessSession,
): Promise<FitnessSession | undefined> {
  const db = getDb();

  // First: exact (source=fit, externalId) match — a clean re-import.
  if (candidate.externalId) {
    const exact = await db.fitnessSessions
      .where("[source+externalId]")
      .equals(["fit", candidate.externalId])
      .first();
    if (exact) return exact;
  }

  // Then: scan a ±60s window on startedAt for any source and check duration
  // overlap. Strava typically lands within seconds of the watch's recorded
  // start; this catches the common case where the user has already synced.
  const min = candidate.startedAt - OVERLAP_WINDOW_MS;
  const max = candidate.startedAt + OVERLAP_WINDOW_MS;
  const nearby = await db.fitnessSessions
    .where("startedAt")
    .between(min, max, true, true)
    .toArray();

  for (const row of nearby) {
    if (
      Math.abs(row.durationSec - candidate.durationSec) <=
      OVERLAP_DURATION_TOLERANCE_SEC
    ) {
      return row;
    }
  }
  return undefined;
}

// Default resolution: if conflict's source is already "fit", "skip" (clean
// re-import). If conflict is from another source, default to "merge" — the
// FIT file likely has richer hrSeries/maxHr/calories than the Strava
// summary, and the user probably wants to enrich rather than replace.
function defaultResolutionFor(
  conflict: FitnessSession | undefined,
): FitImportResolution {
  if (!conflict) return "new";
  if (conflict.source === "fit") return "skip";
  return "merge";
}

export async function previewFitImport(file: File): Promise<FitImportPreview> {
  const parsed = await parseFitFile(file);
  const sessions = mapFitToSessions(parsed);

  const candidates: FitImportCandidate[] = [];
  for (const session of sessions) {
    const conflict = await findOverlap(session);
    candidates.push({
      session,
      conflict,
      defaultResolution: defaultResolutionFor(conflict),
    });
  }

  return { fileName: file.name, candidates };
}

// Apply user-chosen resolutions to a candidate's conflict, producing the
// FitnessSession row that should be written. Returns null for "skip", and
// for "merge" it composes the existing row + FIT-only fields.
export function applyResolution(
  candidate: FitImportCandidate,
  resolution: FitImportResolution,
): FitnessSession | null {
  const { session, conflict } = candidate;

  if (resolution === "skip") return null;
  if (resolution === "new") return session;
  if (resolution === "replace") {
    // Keep the existing row's id so anything that references it (notes,
    // future cloud-sync pointers) stays valid; overwrite everything else.
    return { ...session, id: conflict?.id ?? session.id };
  }
  // "merge" — preserve the existing row's identity + source, overlay
  // FIT-only fields. The FIT file is the richer dataset for HR / calories /
  // maxHr; keep the existing avgHr unless missing.
  if (!conflict) return session;
  return {
    ...conflict,
    avgHr: conflict.avgHr ?? session.avgHr,
    maxHr: session.maxHr ?? conflict.maxHr,
    calories: session.calories ?? conflict.calories,
    hrSeries: session.hrSeries ?? conflict.hrSeries,
  };
}
