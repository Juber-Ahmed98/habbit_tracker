"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Droplet, Minus } from "lucide-react";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { HAPTIC_TAP, vibrate } from "@/lib/haptics";
import { useFitnessStore } from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";
import { toLocalDateString } from "@/lib/utils/date";

// §5.2 — "Hydration: tap-to-add 250ml chips, with a glass-fill visual."
// Chips fill from the bottom up. The undo button removes the last chip
// (which is the only natural "remove" for a tap-to-add UX).

const CHIP_ML = 250;

export function HydrationCard() {
  const today = useMemo(() => toLocalDateString(), []);
  const goal = useSettingsStore((s) => s.settings.hydrationGoalMl);
  const addHydration = useFitnessStore((s) => s.addHydrationForDate);

  const metric = useLiveQuery(
    () => getDb().dailyMetrics.get(today),
    [today],
  );
  const currentMl = metric?.hydrationMl ?? 0;
  const targetMl = Math.max(goal, CHIP_ML);
  const slots = Math.max(1, Math.ceil(targetMl / CHIP_ML));
  const filled = Math.min(slots, Math.floor(currentMl / CHIP_ML));
  const fillPct = Math.min(100, Math.round((currentMl / targetMl) * 100));

  async function addOne() {
    await addHydration(today, CHIP_ML);
    vibrate(HAPTIC_TAP);
  }

  async function removeOne() {
    if (currentMl <= 0) return;
    await addHydration(today, -CHIP_ML);
    vibrate(HAPTIC_TAP);
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
            <Droplet size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Hydration</p>
            <p
              className="text-[11px] leading-tight"
              style={{ color: "var(--text-muted)" }}
            >
              {currentMl.toLocaleString()} / {goal.toLocaleString()} ml
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void removeOne()}
          aria-label="Undo last chip"
          disabled={currentMl <= 0}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text-muted)",
          }}
        >
          <Minus size={14} />
        </button>
      </div>

      {/* Glass-fill visual: a row of chips that solidify as the user taps. */}
      <button
        type="button"
        onClick={() => void addOne()}
        aria-label={`Add ${CHIP_ML} ml`}
        className="mt-3 flex w-full gap-1"
        style={{
          padding: 0,
        }}
      >
        {Array.from({ length: slots }, (_, i) => {
          const isFilled = i < filled;
          return (
            <span
              key={i}
              aria-hidden
              className="h-7 flex-1 rounded-md transition-colors"
              style={{
                backgroundColor: isFilled
                  ? "var(--accent)"
                  : "var(--surface-alt)",
                border: `1px solid ${
                  isFilled ? "var(--accent)" : "var(--border)"
                }`,
              }}
            />
          );
        })}
      </button>

      <p
        className="mt-1.5 text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Tap a chip to add {CHIP_ML} ml · {fillPct}% of goal
      </p>
    </div>
  );
}
