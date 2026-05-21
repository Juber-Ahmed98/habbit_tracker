"use client";

import { getDb } from "@/lib/db";
import { type Habit } from "@/lib/db/schema";
import { getSupabase } from "@/lib/supabase/client";

// Mirrors Dexie habits with a `schedule.timeOfDay` into Supabase's
// `reminder_schedules`. The hourly cron route reads only from Supabase, so
// this is what makes a local schedule actually fire on the server.
//
// Diff strategy:
//   * For every habit with a timeOfDay (and not archived), upsert a row
//     keyed on (user_id, habit_id). If the row already matches we still
//     upsert — cheap, and avoids a per-field comparison here.
//   * For every server row whose habit_id is no longer scheduled locally,
//     delete it.
//   * Skipped no-ops:
//       - no signed-in user (cloud-backup is opt-in; sync is too)
//       - no schedulable habits AND no existing rows (nothing to do)
//
// Concurrency: a 750ms trailing-edge debounce coalesces bursts (onboarding
// seeds ~10 habits back-to-back, and we don't want N fanouts). An in-flight
// promise guard prevents two syncs from racing each other.
//
// Caller convention: any habits-store write that could change schedule rows
// fires-and-forgets `void scheduleReminderSync()`. AppHydrator also kicks it
// once after Dexie hydration so an existing install picks up server state.

const DEBOUNCE_MS = 750;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let rerunAfter = false;

export function scheduleReminderSync(): void {
  if (typeof window === "undefined") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runReminderSync();
  }, DEBOUNCE_MS);
}

// Force-runs immediately, bypassing the debounce. Useful for the
// AppHydrator's once-per-load kick.
export function syncReminderSchedulesNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return runReminderSync();
}

function runReminderSync(): Promise<void> {
  if (inflight) {
    // A sync is already in flight; flag so we re-run once it settles.
    rerunAfter = true;
    return inflight;
  }
  inflight = (async () => {
    try {
      await doSync();
    } catch (err) {
      // Swallow errors — UI doesn't depend on this. Worth logging in dev.
      console.warn("[reminders] schedule sync failed", err);
    } finally {
      inflight = null;
      if (rerunAfter) {
        rerunAfter = false;
        // Re-trigger with the standard debounce so multiple queued requests
        // collapse into a single follow-up.
        scheduleReminderSync();
      }
    }
  })();
  return inflight;
}

async function doSync(): Promise<void> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return; // not signed in — silent no-op
  const userId = userData.user.id;

  const db = getDb();
  const habits = await db.habits.toArray();
  const scheduled = habits.filter(
    (h) => h.schedule.timeOfDay && !h.archivedAt,
  );

  const { data: existingRows, error: existingError } = await supabase
    .from("reminder_schedules")
    .select("habit_id")
    .eq("user_id", userId);
  if (existingError) throw existingError;
  const existingIds = new Set(
    (existingRows ?? []).map((r) => r.habit_id as string),
  );

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nowIso = new Date().toISOString();

  // Upsert all scheduled habits in one call.
  if (scheduled.length > 0) {
    const upsertRows = scheduled.map((h: Habit) => ({
      user_id: userId,
      habit_id: h.id,
      title: h.name,
      tab: h.tab,
      days: h.schedule.days,
      time_local: h.schedule.timeOfDay!,
      timezone,
      updated_at: nowIso,
    }));
    const { error: upsertError } = await supabase
      .from("reminder_schedules")
      .upsert(upsertRows, { onConflict: "user_id,habit_id" });
    if (upsertError) throw upsertError;
  }

  // Delete any server row that no longer corresponds to a scheduled habit.
  const localIds = new Set(scheduled.map((h) => h.id));
  const toDelete = Array.from(existingIds).filter((id) => !localIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("reminder_schedules")
      .delete()
      .eq("user_id", userId)
      .in("habit_id", toDelete);
    if (deleteError) throw deleteError;
  }
}
