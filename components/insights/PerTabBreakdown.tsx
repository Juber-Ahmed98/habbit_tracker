"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, startOfWeek } from "date-fns";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { type HabitTab } from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

const TAB_LABEL: Record<HabitTab, string> = {
  dashboard: "Dashboard",
  fitness: "Fitness",
  work: "Work",
  deen: "Deen",
  lifestyle: "Lifestyle",
} as unknown as Record<HabitTab, string>;
// (Dashboard isn't actually a HabitTab; the cast keeps the lookup tidy.)

const TABS: HabitTab[] = ["fitness", "work", "deen", "lifestyle"];

// Bar-per-tab showing completion ratio this week.
export function PerTabBreakdown() {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);

  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .toArray(),
    [],
  );

  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: startOn });
    return Array.from({ length: 7 }, (_, i) =>
      toLocalDateString(addDays(start, i)),
    );
  }, [startOn]);

  const completions = useLiveQuery(
    () => getDb().completions.where("date").anyOf(weekDates).toArray(),
    [weekDates.join("|")],
  );

  const rows = useMemo(() => {
    if (!habits || !completions) return [];
    const completionByHabit = new Map<string, Set<string>>();
    for (const c of completions) {
      let set = completionByHabit.get(c.habitId);
      if (!set) {
        set = new Set();
        completionByHabit.set(c.habitId, set);
      }
      set.add(c.date);
    }
    return TABS.map((tab) => {
      const tabHabits = habits.filter((h) => h.tab === tab);
      let scheduled = 0;
      let completed = 0;
      for (const d of weekDates) {
        const dow = new Date(d + "T00:00:00").getDay();
        for (const h of tabHabits) {
          if (h.schedule.days.includes(dow)) {
            scheduled += 1;
            if (completionByHabit.get(h.id)?.has(d)) completed += 1;
          }
        }
      }
      const pct = scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100);
      return { tab, scheduled, completed, pct };
    });
  }, [habits, completions, weekDates]);

  return (
    <div
      className="rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="mb-2 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        This week · by tab
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.tab}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium capitalize">
                {TAB_LABEL[r.tab] ?? r.tab}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {r.scheduled === 0
                  ? "no habits"
                  : `${r.completed} / ${r.scheduled} · ${r.pct}%`}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--surface-alt)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${r.pct}%`,
                  backgroundColor: "var(--accent)",
                  transition: "width 250ms ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
