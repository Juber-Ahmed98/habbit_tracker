"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Flame } from "lucide-react";
import { useMemo } from "react";
import { HabitIcon } from "@/components/habits/icons";
import { getDb } from "@/lib/db";
import { HAPTIC_TAP, vibrate } from "@/lib/haptics";
import { type Habit, type StreakSnapshot } from "@/lib/db/schema";
import { useHabitsStore } from "@/lib/stores/habits";
import { toLocalDateString } from "@/lib/utils/date";

const TAB_LABEL: Record<Habit["tab"], string> = {
  fitness: "Fitness",
  work: "Work",
  deen: "Deen",
  lifestyle: "Lifestyle",
};

// Convert a 'HH:mm' string into minutes since midnight today; null if absent.
function timeOfDayMinutes(s?: string): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function scoreHabit({
  habit,
  done,
  streak,
  nowMins,
}: {
  habit: Habit;
  done: boolean;
  streak: number;
  nowMins: number;
}): number {
  if (done) return -Infinity; // never highlight completed
  const dow = new Date().getDay();
  if (!habit.schedule.days.includes(dow)) return -1; // not scheduled today
  let score = 0;
  const t = timeOfDayMinutes(habit.schedule.timeOfDay);
  if (t !== null) {
    if (t < nowMins) {
      // Overdue — the further past, the higher
      score += 100 + Math.min(nowMins - t, 12 * 60) / 30;
    } else {
      // Scheduled later today — closer = higher
      score += 50 - Math.min(t - nowMins, 12 * 60) / 60;
    }
  } else {
    score += 10; // unscheduled but pending today
  }
  if (streak >= 4) score += 30; // streak-at-risk bump per §5.1
  return score;
}

export function HighlightsFeed() {
  const today = useMemo(() => toLocalDateString(), []);
  const toggleHabit = useHabitsStore((s) => s.toggleHabit);

  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .toArray(),
    [],
  );

  const completions = useLiveQuery(
    () =>
      getDb()
        .completions.where("date")
        .equals(today)
        .toArray(),
    [today],
  );

  const snapshots = useLiveQuery(
    () => getDb().streakSnapshots.toArray(),
    [],
  );

  const top = useMemo(() => {
    if (!habits || !completions || !snapshots) return [];
    const doneSet = new Set(completions.map((c) => c.habitId));
    const streakMap = new Map<string, StreakSnapshot>(
      snapshots.map((s) => [s.habitId, s]),
    );
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return habits
      .map((h) => ({
        habit: h,
        done: doneSet.has(h.id),
        streak: streakMap.get(h.id)?.current ?? 0,
        score: scoreHabit({
          habit: h,
          done: doneSet.has(h.id),
          streak: streakMap.get(h.id)?.current ?? 0,
          nowMins,
        }),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [habits, completions, snapshots]);

  if (!habits || habits.length === 0) {
    return null;
  }

  if (top.length === 0) {
    return (
      <div
        className="rounded-card p-4 text-center text-sm"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        Everything&apos;s ticked. Nice work.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {top.map(({ habit, streak }) => (
        <div
          key={habit.id}
          className="flex items-center gap-3 rounded-card px-3 py-2.5"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <HabitIcon name={habit.icon} size={18} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{habit.name}</p>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {TAB_LABEL[habit.tab]}
              {habit.schedule.timeOfDay
                ? ` · ${habit.schedule.timeOfDay}`
                : ""}
              {streak >= 4 ? ` · streak ${streak}` : ""}
            </p>
          </div>
          {streak >= 4 ? (
            <Flame
              size={16}
              aria-hidden
              style={{ color: "var(--streak)" }}
              fill="var(--streak)"
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              vibrate(HAPTIC_TAP);
              void toggleHabit(habit.id);
            }}
            aria-label={`Tick ${habit.name}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            <Check size={18} strokeWidth={3} />
          </button>
        </div>
      ))}
    </div>
  );
}
