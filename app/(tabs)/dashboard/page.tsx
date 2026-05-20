"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateHabitDialog } from "@/components/habits/CreateHabitDialog";
import { DayDetailModal } from "@/components/dashboard/DayDetailModal";
import { HighlightsFeed } from "@/components/dashboard/HighlightsFeed";
import { InsightsStrip } from "@/components/dashboard/InsightsStrip";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { WeekStrip } from "@/components/dashboard/WeekStrip";
import { getDb } from "@/lib/db";
import { toLocalDateString } from "@/lib/utils/date";

// §5.1 Dashboard. Week strip → progress ring → highlights feed → insights.
// Real streak logic + deeper analytics land in Step 4.
export default function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => toLocalDateString(), []);

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
        .toArray(),
    [today],
  );

  const { scheduledCount, completedCount } = useMemo(() => {
    if (!habits || !todayCompletions) {
      return { scheduledCount: 0, completedCount: 0 };
    }
    const dow = new Date().getDay();
    const scheduled = habits.filter((h) => h.schedule.days.includes(dow));
    const doneSet = new Set(todayCompletions.map((c) => c.habitId));
    return {
      scheduledCount: scheduled.length,
      completedCount: scheduled.filter((h) => doneSet.has(h.id)).length,
    };
  }, [habits, todayCompletions]);

  const isEmpty = habits !== undefined && habits.length === 0;

  return (
    <section className="space-y-6 pb-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-text">Dashboard</h1>
          <p className="mt-1 text-xs text-text-muted">
            Today at a glance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label="Add habit"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-ink)",
          }}
        >
          <Plus size={16} /> Add
        </button>
      </header>

      <WeekStrip onSelectDay={(info) => setSelectedDate(info.dateStr)} />

      {isEmpty ? (
        <div
          className="rounded-card p-6 text-center"
          style={{
            border: "1px dashed var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <p className="text-sm">No habits yet.</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            Create your first habit
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <ProgressRing
              completed={completedCount}
              total={scheduledCount}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-[16px] font-semibold">Highlights</h2>
            <HighlightsFeed />
          </div>

          <div className="space-y-3">
            <h2 className="text-[16px] font-semibold">Insights</h2>
            <InsightsStrip />
          </div>
        </>
      )}

      <CreateHabitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
      <DayDetailModal
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
      />
    </section>
  );
}
