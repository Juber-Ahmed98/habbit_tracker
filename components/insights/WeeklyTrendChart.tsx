"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

const WEEKS = 12;

// 12-week bar chart of total completions per week (any source, including
// freeze days). Anchored to Settings.startOfWeek so bars align with the
// Dashboard WeekStrip.
export function WeeklyTrendChart() {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);

  const { allDates, weekBuckets } = useMemo(() => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: startOn });
    const buckets: { label: string; start: string; end: string }[] = [];
    const dates: string[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      const start = subWeeks(thisWeekStart, i);
      const end = addDays(start, 6);
      const startStr = toLocalDateString(start);
      const endStr = toLocalDateString(end);
      buckets.push({
        label: format(start, "d MMM"),
        start: startStr,
        end: endStr,
      });
      for (let d = 0; d < 7; d++) {
        dates.push(toLocalDateString(addDays(start, d)));
      }
    }
    return { allDates: dates, weekBuckets: buckets };
  }, [startOn]);

  const completions = useLiveQuery(
    () => getDb().completions.where("date").anyOf(allDates).toArray(),
    [allDates.join("|")],
  );

  const data = useMemo(() => {
    if (!completions) return [];
    return weekBuckets.map((b) => ({
      label: b.label,
      count: completions.filter((c) => c.date >= b.start && c.date <= b.end)
        .length,
    }));
  }, [completions, weekBuckets]);

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
        Last 12 weeks · ticks per week
      </p>
      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-alt)" }}
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-muted)" }}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
