"use client";

import { type FitnessSessionType } from "../db/schema";

// localStorage snapshot for an in-flight live HR session. Lets the
// /fitness/live screen recover if the tab is closed or the BLE link drops
// before the user taps Stop. Snapshot is written every 5s by the page; cleared
// on Save or Discard.

const KEY = "live-workout-v1";

export type LiveSnapshot = {
  startedAt: number;
  type: FitnessSessionType;
  deviceName?: string;
  // Downsampled or raw — caller decides. For now the page stores 1 sample/sec.
  hrSeries: Array<{ t: number; bpm: number }>;
  updatedAt: number;
};

export function saveSnapshot(snap: LiveSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    // Quota or private-mode failure — non-fatal, snapshots are best-effort.
  }
}

export function loadSnapshot(): LiveSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveSnapshot;
    if (
      typeof parsed.startedAt === "number" &&
      Array.isArray(parsed.hrSeries) &&
      typeof parsed.type === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
