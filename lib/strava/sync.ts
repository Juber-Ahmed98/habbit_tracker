"use client";

import { getDb } from "@/lib/db";
import { useHabitsStore } from "@/lib/stores/habits";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";
import { mapStravaActivity } from "./map";
import { type StravaSummaryActivity } from "./types";

// Client-side Strava sync orchestrator. Pages /api/strava/activities, dedupes
// against the [source+externalId] index, bulk-writes new FitnessSession rows,
// auto-ticks the Gym habit for each gym-typed activity, and updates
// Settings.strava.lastSyncAt at the end. The server proxy refreshes tokens
// transparently; a 401 here means the user has disconnected on Strava's side
// or the cookie has been cleared.

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap — 50 * 100 = 5,000 activities per sync
// 14-day lookback on the `after` param so late-uploaded activities backdated
// within two weeks still get picked up. Dedupe handles repeats.
const LOOKBACK_SEC = 14 * 24 * 60 * 60;

export type SyncResult = {
  ok: boolean;
  inserted: number;
  fetched: number;
  reason?: "not_connected" | "network" | "unknown";
  detail?: string;
};

let inFlight: Promise<SyncResult> | null = null;

export function syncStravaActivities(): Promise<SyncResult> {
  // De-duplicate concurrent calls. Auto-sync on app open + a manual Refresh
  // tap could otherwise race.
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      return await runSync();
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

async function runSync(): Promise<SyncResult> {
  const settingsStore = useSettingsStore.getState();
  const strava = settingsStore.settings.strava;
  const lastSyncAt = strava?.lastSyncAt;

  const afterParam =
    lastSyncAt !== undefined
      ? Math.max(0, Math.floor(lastSyncAt / 1000) - LOOKBACK_SEC)
      : undefined;

  const fetched: StravaSummaryActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL("/api/strava/activities", window.location.origin);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    if (afterParam !== undefined) url.searchParams.set("after", String(afterParam));

    const res = await fetch(url.toString(), {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (res.status === 401) {
      // Cookie missing or refresh failed — flip Dexie to disconnected so the
      // UI reflects reality on next render.
      await settingsStore.update({
        strava: { connected: false, athleteId: strava?.athleteId, lastSyncAt },
      });
      return { ok: false, inserted: 0, fetched: fetched.length, reason: "not_connected" };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        inserted: 0,
        fetched: fetched.length,
        reason: "network",
        detail: `${res.status} ${detail}`.slice(0, 200),
      };
    }
    const batch = (await res.json()) as StravaSummaryActivity[];
    fetched.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const inserted = await persistActivities(fetched);

  await settingsStore.update({
    strava: {
      connected: true,
      athleteId: strava?.athleteId,
      lastSyncAt: Date.now(),
    },
  });

  return { ok: true, inserted, fetched: fetched.length };
}

async function persistActivities(
  activities: StravaSummaryActivity[],
): Promise<number> {
  if (activities.length === 0) return 0;
  const db = getDb();

  // Dedupe in a single query using the [source+externalId] compound index.
  const externalIds = activities.map((a) => String(a.id));
  const existing = await db.fitnessSessions
    .where("[source+externalId]")
    .anyOf(externalIds.map((id) => ["strava", id]))
    .toArray();
  const existingIds = new Set(
    existing.map((s) => s.externalId).filter((v): v is string => Boolean(v)),
  );

  const fresh = activities
    .filter((a) => !existingIds.has(String(a.id)))
    .map(mapStravaActivity);

  if (fresh.length === 0) return 0;

  await db.fitnessSessions.bulkPut(fresh);

  // Auto-tick the Gym habit per §3 Tier 1. Look up the habit once; tick each
  // gym session for its local date.
  const gymHabit = await db.habits
    .where("tab")
    .equals("fitness")
    .filter((h) => h.category === "fitness-workout" && !h.archivedAt)
    .first();
  if (gymHabit) {
    const habitsStore = useHabitsStore.getState();
    const datesTicked = new Set<string>();
    for (const session of fresh) {
      if (session.type !== "gym") continue;
      const dateStr = toLocalDateString(new Date(session.startedAt));
      if (datesTicked.has(dateStr)) continue;
      datesTicked.add(dateStr);
      // tickHabit is idempotent — if the user already ticked manually, the
      // existing row wins. New ticks land with source="strava" so insights
      // can distinguish auto-tracked vs manual completions later.
      await habitsStore.tickHabit(gymHabit.id, dateStr, "strava");
    }
  }

  return fresh.length;
}
