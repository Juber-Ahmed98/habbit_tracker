"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import { getDb } from "@/lib/db";
import { HabitIcon } from "@/components/habits/icons";

// Drill-down opened by tapping a day in the WeekStrip. Read-only — editing
// past days isn't in scope for Step 3. Shows scheduled habits for that day
// alongside whether they were completed.
export function DayDetailModal({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const open = !!date;

  const data = useLiveQuery(async () => {
    if (!date) return null;
    const habits = await getDb()
      .habits.filter((h) => !h.archivedAt)
      .toArray();
    const dow = parseISO(date).getDay();
    const scheduled = habits.filter((h) => h.schedule.days.includes(dow));
    const completions = await getDb()
      .completions.where("date")
      .equals(date)
      .toArray();
    const doneIds = new Set(completions.map((c) => c.habitId));
    return { scheduled, doneIds };
  }, [date]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="day-modal"
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Habits for ${date}`}
            className="relative w-full max-w-md"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-[20px] font-semibold">
                {date ? format(parseISO(date), "EEEE d MMM") : ""}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 p-2"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 px-4 pt-3">
              {!data || data.scheduled.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No habits scheduled.
                </p>
              ) : (
                data.scheduled.map((h) => {
                  const done = data.doneIds.has(h.id);
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-3 rounded-card px-3 py-2"
                      style={{
                        backgroundColor: done
                          ? "var(--accent)"
                          : "var(--surface-alt)",
                        color: done ? "var(--accent-ink)" : "var(--text)",
                      }}
                    >
                      <HabitIcon name={h.icon} size={18} aria-hidden />
                      <span className="flex-1 text-sm font-medium">
                        {h.name}
                      </span>
                      {done ? <Check size={18} strokeWidth={3} /> : null}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
