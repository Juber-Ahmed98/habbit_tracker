"use client";

import { addDays, format, isAfter, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { getDb } from "@/lib/db";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

type DayInfo = {
  date: Date;
  dateStr: string;
  weekdayLetter: string;
  dayNumber: number;
  isToday: boolean;
  isFuture: boolean;
  scheduled: number;
  completed: number;
};

function computeDayInfo(
  date: Date,
  habits: { id: string; schedule: { days: number[] } }[],
  completionsByDate: Map<string, Set<string>>,
  now: Date,
): DayInfo {
  const dateStr = toLocalDateString(date);
  const dow = date.getDay();
  const scheduledHabits = habits.filter((h) => h.schedule.days.includes(dow));
  const dones = completionsByDate.get(dateStr) ?? new Set<string>();
  const completed = scheduledHabits.filter((h) => dones.has(h.id)).length;
  const today = startOfDay(now);
  return {
    date,
    dateStr,
    weekdayLetter: format(date, "EEEEE"), // single letter M T W ...
    dayNumber: Number(format(date, "d")),
    isToday: isSameDay(date, today),
    isFuture: isAfter(startOfDay(date), today),
    scheduled: scheduledHabits.length,
    completed,
  };
}

export function WeekStrip({
  onSelectDay,
}: {
  onSelectDay?: (info: DayInfo) => void;
}) {
  const startOfWeekChoice = useSettingsStore(
    (s) => s.settings.startOfWeek,
  );
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const now = useMemo(() => new Date(), []);
  const baseWeekStart = useMemo(
    () => startOfWeek(now, { weekStartsOn: startOfWeekChoice }),
    [now, startOfWeekChoice],
  );
  const weekStart = useMemo(
    () => addDays(baseWeekStart, offsetWeeks * 7),
    [baseWeekStart, offsetWeeks],
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const dateStrs = useMemo(() => days.map(toLocalDateString), [days]);

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
        .anyOf(dateStrs)
        .toArray(),
    [dateStrs.join("|")],
  );

  const completionsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of completions ?? []) {
      let set = map.get(c.date);
      if (!set) {
        set = new Set();
        map.set(c.date, set);
      }
      set.add(c.habitId);
    }
    return map;
  }, [completions]);

  const dayInfos = useMemo(
    () =>
      days.map((d) =>
        computeDayInfo(d, habits ?? [], completionsByDate, now),
      ),
    [days, habits, completionsByDate, now],
  );

  const rangeLabel = `${format(weekStart, "d MMM")} – ${format(
    addDays(weekStart, 6),
    "d MMM",
  )}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffsetWeeks((v) => v - 1)}
          aria-label="Previous week"
          className="rounded-lg p-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {offsetWeeks === 0 ? "This week" : rangeLabel}
        </span>
        <button
          type="button"
          onClick={() => setOffsetWeeks((v) => v + 1)}
          aria-label="Next week"
          className="rounded-lg p-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {dayInfos.map((d) => (
          <DayChip
            key={d.dateStr}
            info={d}
            onClick={() => onSelectDay?.(d)}
          />
        ))}
      </div>
    </div>
  );
}

function DayChip({
  info,
  onClick,
}: {
  info: DayInfo;
  onClick: () => void;
}) {
  // Status dot per §5.1:
  //   future / no habits scheduled → grey outline
  //   none done → outline dot
  //   some done → half-filled
  //   all done → solid yellow
  const noHabits = info.scheduled === 0;
  const ratio = noHabits ? 0 : info.completed / info.scheduled;

  let dot: "future" | "empty" | "half" | "full";
  if (info.isFuture || noHabits) dot = "future";
  else if (ratio === 0) dot = "empty";
  else if (ratio >= 1) dot = "full";
  else dot = "half";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${format(info.date, "EEEE d MMMM")}, ${info.completed} of ${info.scheduled} done`}
      className="flex flex-col items-center gap-1 rounded-xl px-1 py-2"
      style={{
        backgroundColor: info.isToday ? "var(--surface-alt)" : "transparent",
        border: info.isToday
          ? "1px solid var(--accent)"
          : "1px solid transparent",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {info.weekdayLetter}
      </span>
      <span
        className="text-sm font-semibold"
        style={{
          color: info.isToday ? "var(--accent)" : "var(--text)",
        }}
      >
        {info.dayNumber}
      </span>
      <StatusDot variant={dot} />
    </button>
  );
}

function StatusDot({
  variant,
}: {
  variant: "future" | "empty" | "half" | "full";
}) {
  if (variant === "full") {
    return (
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: "var(--accent)" }}
      />
    );
  }
  if (variant === "empty") {
    return (
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ border: "1.5px solid var(--neutral-outline)" }}
      />
    );
  }
  if (variant === "half") {
    return (
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--accent) 50%, transparent 50%)",
          border: "1.5px solid var(--accent)",
        }}
      />
    );
  }
  // future / no-habits
  return (
    <span
      aria-hidden
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: "var(--border)" }}
    />
  );
}
