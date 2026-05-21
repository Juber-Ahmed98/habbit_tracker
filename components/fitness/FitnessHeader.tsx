"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNowStrict } from "date-fns";
import { Flame, Radio } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { type FitnessSession, type StreakSnapshot } from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDistance } from "@/lib/utils/format";

// §5.2 header strip. Three cells: workout streak, last activity preview, and
// a "Live Workout" entry into the Web Bluetooth HR monitor at /fitness/live.

const SESSION_LABEL: Record<FitnessSession["type"], string> = {
  run: "Run",
  ride: "Ride",
  gym: "Gym",
  walk: "Walk",
  swim: "Swim",
  other: "Activity",
};

export function FitnessHeader() {
  const units = useSettingsStore((s) => s.settings.units);

  // Workout streak — pulled from the snapshot for the Gym habit. Falls back
  // to "—" if the user has no fitness-workout habit yet (catalogue not seeded,
  // or it was deleted).
  const gymHabit = useLiveQuery(
    () =>
      getDb()
        .habits.where("tab")
        .equals("fitness")
        .filter((h) => h.category === "fitness-workout" && !h.archivedAt)
        .first(),
    [],
  );
  const snapshot = useLiveQuery<StreakSnapshot | undefined>(
    () =>
      gymHabit
        ? getDb().streakSnapshots.get(gymHabit.id)
        : Promise.resolve<StreakSnapshot | undefined>(undefined),
    [gymHabit?.id],
  );
  const streak = snapshot?.current ?? 0;

  // Last activity — newest fitnessSessions row.
  const lastSession = useLiveQuery(
    () =>
      getDb()
        .fitnessSessions.orderBy("startedAt")
        .reverse()
        .limit(1)
        .toArray()
        .then((rows) => rows[0]),
    [],
  );

  return (
    <section className="grid grid-cols-3 gap-2">
      {/* Streak */}
      <div
        className="rounded-card px-3 py-2.5"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Workout streak
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold">
          <Flame
            size={14}
            aria-hidden
            style={{ color: "var(--streak)" }}
            fill={streak >= 7 ? "var(--streak)" : "none"}
          />
          {streak > 0 ? `${streak}d` : "—"}
        </p>
      </div>

      {/* Last activity */}
      <div
        className="rounded-card px-3 py-2.5"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Last activity
        </p>
        {lastSession ? (
          <div className="mt-1">
            <p className="truncate text-sm font-semibold">
              {SESSION_LABEL[lastSession.type]}
              {(() => {
                const d = formatDistance(lastSession.distanceM, units);
                return d ? ` · ${d}` : "";
              })()}
            </p>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {formatDistanceToNowStrict(new Date(lastSession.startedAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        ) : (
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Log a session, or connect Strava in Settings.
          </p>
        )}
      </div>

      {/* Live workout — opens the BLE HR monitor overlay at /fitness/live. */}
      <Link
        href="/fitness/live"
        aria-label="Live workout"
        className="flex flex-col items-start justify-between rounded-card px-3 py-2.5 text-left"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Live workout
        </p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
          <Radio size={14} aria-hidden /> Start
        </span>
      </Link>

    </section>
  );
}
