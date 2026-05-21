"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Footprints, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { getDb } from "@/lib/db";
import { HAPTIC_TAP, vibrate } from "@/lib/haptics";
import { useFitnessStore } from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

// §5.2 — "Steps: progress bar against daily goal (default 10k), filled from
// Garmin/Strava when available, manual `+` button otherwise." Step 6 is the
// manual path: tap the pencil to set today's step count. The pencil is also
// the entry point we'll wire up later to be overwritten by Strava sync.

export function StepsCard() {
  const today = useMemo(() => toLocalDateString(), []);
  const goal = useSettingsStore((s) => s.settings.stepGoal);
  const setSteps = useFitnessStore((s) => s.setStepsForDate);

  const metric = useLiveQuery(
    () => getDb().dailyMetrics.get(today),
    [today],
  );
  const current = metric?.stepsCount ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  function openEditor() {
    setDraft(String(current));
    setEditing(true);
  }

  async function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) {
      await setSteps(today, n);
      vibrate(HAPTIC_TAP);
    }
    setEditing(false);
  }

  return (
    <div
      className="rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text-muted)",
            }}
          >
            <Footprints size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Steps</p>
            <p
              className="text-[11px] leading-tight"
              style={{ color: "var(--text-muted)" }}
            >
              {current.toLocaleString()} / {goal.toLocaleString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openEditor}
          aria-label="Edit steps"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text-muted)",
          }}
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--accent)",
            transition: "width 250ms ease-out",
          }}
        />
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
          <button
            type="button"
            onClick={() => void commit()}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
