"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, startOfWeek, subDays } from "date-fns";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

// Computes the rolling 7-day and rolling 30-day completion rates: the
// percentage of (scheduled habit × day) pairs that were actually completed.
// Excludes archived habits.
function dateRange(end: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    toLocalDateString(subDays(end, days - 1 - i)),
  );
}

export function SummaryCards() {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);

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

  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: startOn });
    return Array.from({ length: 7 }, (_, i) =>
      toLocalDateString(addDays(start, i)),
    );
  }, [startOn]);

  const thirtyDays = useMemo(() => dateRange(new Date(), 30), []);

  const weekCompletions = useLiveQuery(
    () =>
      getDb()
        .completions.where("date")
        .anyOf(weekDates)
        .toArray(),
    [weekDates.join("|")],
  );

  const monthCompletions = useLiveQuery(
    () =>
      getDb()
        .completions.where("date")
        .anyOf(thirtyDays)
        .toArray(),
    [thirtyDays.join("|")],
  );

  const stats = useMemo(() => {
    if (!habits || !snapshots || !weekCompletions || !monthCompletions) {
      return null;
    }

    const bestCurrent = snapshots.reduce((max, s) => Math.max(max, s.current), 0);
    const bestLongest = snapshots.reduce((max, s) => Math.max(max, s.longest), 0);

    // Schedule-aware denominator: for each date in range, count habits scheduled.
    const scheduledFor = (dateStr: string) => {
      const dow = new Date(dateStr + "T00:00:00").getDay();
      return habits.filter((h) => h.schedule.days.includes(dow)).length;
    };

    const weekDenominator = weekDates.reduce(
      (sum, d) => sum + scheduledFor(d),
      0,
    );
    const monthDenominator = thirtyDays.reduce(
      (sum, d) => sum + scheduledFor(d),
      0,
    );

    const weekNumerator = weekCompletions.length;
    const monthNumerator = monthCompletions.length;

    const pct = (n: number, d: number) =>
      d === 0 ? 0 : Math.round((n / d) * 100);

    return {
      bestCurrent,
      bestLongest,
      weekRate: pct(weekNumerator, weekDenominator),
      monthRate: pct(monthNumerator, monthDenominator),
      activeHabits: habits.length,
    };
  }, [habits, snapshots, weekCompletions, monthCompletions, weekDates, thirtyDays]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-card"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Best current streak",
      value: stats.bestCurrent > 0 ? `${stats.bestCurrent} days` : "—",
    },
    {
      label: "Longest ever",
      value: stats.bestLongest > 0 ? `${stats.bestLongest} days` : "—",
    },
    {
      label: "This week",
      value: `${stats.weekRate}%`,
    },
    {
      label: "Last 30 days",
      value: `${stats.monthRate}%`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div
          key={c.label}
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
            {c.label}
          </p>
          <p className="mt-0.5 text-xl font-semibold leading-tight">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
