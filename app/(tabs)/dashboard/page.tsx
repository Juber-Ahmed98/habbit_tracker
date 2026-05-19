"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateHabitDialog } from "@/components/habits/CreateHabitDialog";
import { HabitCard } from "@/components/habits/HabitCard";
import { getDb } from "@/lib/db";

// Step 2 sandbox: a flat list of HabitCards so the completion
// micro-interaction can be exercised on-device. Step 3 replaces this with
// the real Dashboard (week strip, ring, highlights).
export default function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const habits = useLiveQuery(
    () =>
      getDb()
        .habits.filter((h) => !h.archivedAt)
        .sortBy("order"),
    [],
  );

  const isLoading = habits === undefined;
  const isEmpty = !isLoading && habits.length === 0;

  return (
    <section className="pb-6">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-text">Dashboard</h1>
          <p className="mt-1 text-xs text-text-muted">
            Step 2 sandbox · real layout lands in step 3
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

      {isLoading && (
        <p className="text-sm text-text-muted">Loading…</p>
      )}

      {isEmpty && (
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
      )}

      {habits && habits.length > 0 && (
        <div className="space-y-3">
          {habits.map((h) => (
            <HabitCard key={h.id} habit={h} />
          ))}
        </div>
      )}

      <CreateHabitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </section>
  );
}
