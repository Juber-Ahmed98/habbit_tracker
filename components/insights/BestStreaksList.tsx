"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Flame } from "lucide-react";
import { useMemo } from "react";
import { HabitIcon } from "@/components/habits/icons";
import { getDb } from "@/lib/db";

// Top habits ordered by current streak (then by longest). Up to 8 rows.
// Habits with no streak are still shown if there's room — gives context.
export function BestStreaksList() {
  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .toArray(),
    [],
  );
  const snapshots = useLiveQuery(
    () => getDb().streakSnapshots.toArray(),
    [],
  );

  const rows = useMemo(() => {
    if (!habits || !snapshots) return [];
    const snapById = new Map(snapshots.map((s) => [s.habitId, s]));
    return habits
      .map((h) => {
        const s = snapById.get(h.id);
        return {
          habit: h,
          current: s?.current ?? 0,
          longest: s?.longest ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.current !== a.current) return b.current - a.current;
        return b.longest - a.longest;
      })
      .slice(0, 8);
  }, [habits, snapshots]);

  return (
    <div
      className="rounded-card px-3 py-2"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="mb-2 px-1 pt-1 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Top streaks
      </p>
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {rows.map((r) => (
          <li
            key={r.habit.id}
            className="flex items-center gap-3 px-1 py-2"
          >
            <HabitIcon name={r.habit.icon} size={16} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.habit.name}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              longest {r.longest}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold">
              <Flame
                size={14}
                aria-hidden
                style={{ color: "var(--streak)" }}
                fill={r.current >= 7 ? "var(--streak)" : "none"}
              />
              {r.current}
            </span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li
            className="px-1 py-3 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No habits yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
