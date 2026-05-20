"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { HabitCard } from "@/components/habits/HabitCard";
import { useHabitsByCategory } from "@/lib/db/hooks";
import { useHabitsStore } from "@/lib/stores/habits";

// One sub-card per period (AM/PM). Lists named supplements as toggle
// HabitCards and offers a small inline "Add" form. Items are full Habits
// under the hood so they get streaks, completion history, and edit-sheet
// access for free.
export function SupplementsList({
  category,
  title,
  icon,
}: {
  category: "lifestyle-supplements-am" | "lifestyle-supplements-pm";
  title: string;
  icon: string;
}) {
  const items = useHabitsByCategory("lifestyle", category);
  const createHabit = useHabitsStore((s) => s.createHabit);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const name = draft.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    await createHabit({
      tab: "lifestyle",
      category,
      name,
      icon,
      type: "toggle",
    });
    setDraft("");
    setAdding(false);
  };

  return (
    <div
      className="rounded-card p-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add ${title.toLowerCase()}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
            }}
          >
            <Plus size={14} /> Add
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
            aria-label="Cancel"
            className="p-1"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mb-2 flex gap-2"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Vitamin D"
            className="flex-1 rounded-lg px-2 py-1 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
          <button
            type="submit"
            className="rounded-lg px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            Add
          </button>
        </form>
      ) : null}

      {items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((h) => <HabitCard key={h.id} habit={h} />)}
        </div>
      ) : !adding ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No items yet — add the supplements you take.
        </p>
      ) : null}
    </div>
  );
}
