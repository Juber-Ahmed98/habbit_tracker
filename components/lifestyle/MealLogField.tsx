"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDb } from "@/lib/db";
import { toLocalDateString } from "@/lib/utils/date";

// Free-text meal log for today, debounced 400ms. Same shape as the work
// tab's daily plan field — both are per-date free text. Inlined for now;
// if we grow more of these, factor out a <DailyText> primitive.
export function MealLogField() {
  const today = useMemo(() => toLocalDateString(), []);
  const persisted = useLiveQuery(
    () => getDb().mealLogs.get(today),
    [today],
  );

  const [draft, setDraft] = useState("");
  const userTouched = useRef(false);

  useEffect(() => {
    if (!userTouched.current) setDraft(persisted?.text ?? "");
  }, [persisted?.text]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (text: string) => {
    userTouched.current = true;
    setDraft(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void getDb().mealLogs.put({ date: today, text, updatedAt: Date.now() });
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
        htmlFor="meal-log"
        className="mb-1 block text-xs font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        Meal log (optional)
      </label>
      <textarea
        id="meal-log"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="What you ate today…"
        className="w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
    </div>
  );
}
