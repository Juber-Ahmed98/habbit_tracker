"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, startOfWeek } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

// Horizontal scroll of mini-cards per §5.1 "Insights strip (new)".
// Deeper analytics (best streak, completion-rate trends) land in Step 4
// alongside the real streak logic — for Step 3 these are computed inline
// from the data we already have.

type Card = {
  key: string;
  label: string;
  value: string;
  hint?: string;
};

export function InsightsStrip() {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);
  const today = useMemo(() => toLocalDateString(), []);

  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: startOn });
    return Array.from({ length: 7 }, (_, i) =>
      toLocalDateString(addDays(start, i)),
    );
  }, [startOn]);

  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .toArray(),
    [],
  );

  const todayCompletions = useLiveQuery(
    () =>
      getDb()
        .completions.where("date")
        .equals(today)
        .count(),
    [today],
  );

  const weekCompletions = useLiveQuery(
    () =>
      getDb()
        .completions.where("date")
        .anyOf(weekDates)
        .count(),
    [weekDates.join("|")],
  );

  const snapshots = useLiveQuery(
    () => getDb().streakSnapshots.toArray(),
    [],
  );

  // Fitness sessions this calendar week — counts any source (manual / Strava
  // / BLE / FIT / future Garmin). Range query against the indexed startedAt
  // column so the count stays cheap as the log grows.
  const weekSessions = useLiveQuery(
    () => {
      const start = startOfWeek(new Date(), { weekStartsOn: startOn });
      const end = addDays(start, 7);
      return getDb()
        .fitnessSessions.where("startedAt")
        .between(start.getTime(), end.getTime(), true, false)
        .count();
    },
    [startOn],
  );

  const cards: Card[] = useMemo(() => {
    const activeCount = habits?.length ?? 0;
    const todayDone = todayCompletions ?? 0;
    const todayDow = new Date().getDay();
    const scheduledToday =
      habits?.filter((h) => h.schedule.days.includes(todayDow)).length ?? 0;
    const ratePct =
      scheduledToday === 0
        ? 0
        : Math.round((todayDone / scheduledToday) * 100);
    const bestStreak =
      snapshots && snapshots.length > 0
        ? Math.max(...snapshots.map((s) => s.current))
        : 0;

    return [
      {
        key: "rate",
        label: "Today's completion",
        value: `${ratePct}%`,
        hint: `${todayDone} / ${scheduledToday}`,
      },
      {
        key: "week",
        label: "This week's ticks",
        value: String(weekCompletions ?? 0),
      },
      {
        key: "active",
        label: "Active habits",
        value: String(activeCount),
      },
      {
        key: "streak",
        label: "Best current streak",
        value: bestStreak > 0 ? `${bestStreak} days` : "—",
      },
      {
        key: "sessions",
        label: "Sessions this week",
        value: String(weekSessions ?? 0),
      },
    ];
  }, [habits, todayCompletions, weekCompletions, snapshots, weekSessions]);

  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="flex gap-2" style={{ minWidth: "min-content" }}>
        {cards.map((c) => (
          <Link
            key={c.key}
            href="/insights"
            className="flex min-w-[140px] flex-col gap-0.5 rounded-card px-3 py-2.5"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              {c.label}
            </span>
            <span className="text-lg font-semibold leading-tight">
              {c.value}
            </span>
            {c.hint ? (
              <span
                className="text-[11px] leading-tight"
                style={{ color: "var(--text-muted)" }}
              >
                {c.hint}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
