"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { addDays } from "date-fns";
import { getDb } from "@/lib/db";
import { toLocalDateString } from "@/lib/utils/date";

// "Tomorrow's top 3" — free-text plan saved into dailyPlans keyed by the
// date the plan is FOR (i.e. tomorrow's date in the user's local zone).
// We debounce writes by 400ms via onChange to keep typing snappy without
// hammering IndexedDB.
export function DailyPlanField() {
  const tomorrow = toLocalDateString(addDays(new Date(), 1));

  const persisted = useLiveQuery(
    () => getDb().dailyPlans.get(tomorrow),
    [tomorrow],
  );

  // Local mirror so typing isn't blocked on Dexie round-trips. We sync once
  // the live query lands, but only if the user hasn't started editing.
  const [draft, setDraft] = useState("");
  const userTouched = useRef(false);

  useEffect(() => {
    if (!userTouched.current) {
      setDraft(persisted?.text ?? "");
    }
  }, [persisted?.text]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (text: string) => {
    userTouched.current = true;
    setDraft(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void getDb().dailyPlans.put({
        date: tomorrow,
        text,
        updatedAt: Date.now(),
      });
    }, 400);
  };

  return (
    <div
      className="rounded-card p-3"
      style={{
        backgroundColor: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <label
        htmlFor="daily-plan-top3"
        className="mb-1 block text-xs font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        Tomorrow&apos;s top 3
      </label>
      <textarea
        id="daily-plan-top3"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={"1. …\n2. …\n3. …"}
        className="w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
    </div>
  );
}
