"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { useMemo, useState } from "react";
import { getDb } from "@/lib/db";
import { type Completion, type Habit } from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

const WEEKS = 12;

type CellState = "unscheduled" | "missed" | "done" | "freeze";

// 12-week × 7-day heatmap for a single selected habit. Cells classify
// into unscheduled / missed / done / freeze for legibility.
export function HabitHeatmap() {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);

  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .sortBy("order"),
    [],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: Habit | undefined =
    habits?.find((h) => h.id === selectedId) ?? habits?.[0];

  const { columns, allDates } = useMemo(() => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: startOn });
    const cols: { weekStart: Date; days: Date[] }[] = [];
    const flat: string[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const start = subWeeks(thisWeekStart, i);
      const days = Array.from({ length: 7 }, (_, d) => addDays(start, d));
      cols.push({ weekStart: start, days });
      for (const d of days) flat.push(toLocalDateString(d));
    }
    return { columns: cols, allDates: flat };
  }, [startOn]);

  const completions = useLiveQuery<Completion[]>(
    () => {
      if (!selected) return Promise.resolve<Completion[]>([]);
      return getDb()
        .completions.where("habitId")
        .equals(selected.id)
        .filter((c) => allDates.includes(c.date))
        .toArray();
    },
    [selected?.id, allDates.join("|")],
  );

  const completionByDate = useMemo(() => {
    const map = new Map<string, "done" | "freeze">();
    for (const c of completions ?? []) {
      map.set(c.date, c.source === "freeze" ? "freeze" : "done");
    }
    return map;
  }, [completions]);

  if (!habits || habits.length === 0) {
    return null;
  }

  const cellFor = (d: Date): CellState => {
    if (!selected) return "unscheduled";
    if (d > new Date()) return "unscheduled"; // treat future as blank
    if (!selected.schedule.days.includes(d.getDay())) return "unscheduled";
    const dateStr = toLocalDateString(d);
    const c = completionByDate.get(dateStr);
    if (c === "freeze") return "freeze";
    if (c === "done") return "done";
    return "missed";
  };

  return (
    <div
      className="rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Heatmap · last 12 weeks
        </p>
        <select
          value={selected?.id ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
          className="max-w-[180px] rounded-lg px-2 py-1 text-xs outline-none"
          style={{
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        >
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.days.map((d) => {
              const state = cellFor(d);
              return (
                <span
                  key={d.toISOString()}
                  aria-label={`${format(d, "EEE d MMM")} ${state}`}
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    backgroundColor: cellBg(state),
                    border:
                      state === "missed"
                        ? "1px solid var(--neutral-outline)"
                        : "none",
                    opacity: state === "missed" ? 0.6 : 1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div
        className="mt-2 flex flex-wrap gap-3 text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        <Legend swatch={cellBg("done")} label="Done" />
        <Legend swatch={cellBg("freeze")} label="Freeze" />
        <Legend
          swatch={cellBg("missed")}
          label="Missed"
          border="var(--neutral-outline)"
        />
        <Legend swatch={cellBg("unscheduled")} label="Off-day" border="var(--border)" />
      </div>
    </div>
  );
}

function cellBg(state: CellState): string {
  switch (state) {
    case "done":
      return "var(--accent)";
    case "freeze":
      return "var(--surface-alt)";
    case "missed":
      return "transparent";
    case "unscheduled":
      return "transparent";
  }
}

function Legend({
  swatch,
  label,
  border,
}: {
  swatch: string;
  label: string;
  border?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[3px]"
        style={{
          backgroundColor: swatch,
          border: border ? `1px solid ${border}` : "none",
        }}
      />
      {label}
    </span>
  );
}
