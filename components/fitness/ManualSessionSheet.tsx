"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { type FitnessSessionType } from "@/lib/db/schema";
import { useFitnessStore } from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";

// Modal sheet to manually log a FitnessSession. Step 6 is intentionally
// lightweight — type, when, duration, optional distance + notes. HR/calories
// arrive with Strava (step 7) and BLE (step 8) where the source actually
// provides them.

type Props = {
  open: boolean;
  onClose: () => void;
};

const TYPE_OPTIONS: Array<{ value: FitnessSessionType; label: string }> = [
  { value: "run", label: "Run" },
  { value: "ride", label: "Ride" },
  { value: "gym", label: "Gym" },
  { value: "walk", label: "Walk" },
  { value: "swim", label: "Swim" },
  { value: "other", label: "Other" },
];

const DISTANCE_TYPES: ReadonlySet<FitnessSessionType> = new Set([
  "run",
  "ride",
  "walk",
  "swim",
]);

function nowDateTimeLocal(): string {
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ManualSessionSheet({ open, onClose }: Props) {
  const createSession = useFitnessStore((s) => s.createManualSession);
  const units = useSettingsStore((s) => s.settings.units);

  const [type, setType] = useState<FitnessSessionType>("gym");
  const [when, setWhen] = useState<string>(nowDateTimeLocal);
  const [durationMin, setDurationMin] = useState<string>("30");
  const [distance, setDistance] = useState<string>(""); // user-unit value (km or mi)
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const showDistance = DISTANCE_TYPES.has(type);
  const distanceLabel = useMemo(
    () => (units === "imperial" ? "Distance (miles)" : "Distance (km)"),
    [units],
  );

  if (!open) return null;

  function reset() {
    setType("gym");
    setWhen(nowDateTimeLocal());
    setDurationMin("30");
    setDistance("");
    setNotes("");
  }

  async function save() {
    if (submitting) return;
    const minutes = Number(durationMin);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const startedAt = new Date(when).getTime();
    if (!Number.isFinite(startedAt)) return;
    // User typed distance in km/mi — convert to metres for storage.
    let distanceM: number | undefined;
    if (showDistance && distance.trim() !== "") {
      const n = Number(distance);
      if (Number.isFinite(n) && n > 0) {
        distanceM =
          units === "imperial"
            ? Math.round(n * 1609.344)
            : Math.round(n * 1000);
      }
    }
    setSubmitting(true);
    try {
      await createSession({
        type,
        startedAt,
        durationSec: Math.round(minutes * 60),
        distanceM,
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Log activity"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="relative w-full max-w-md space-y-4 rounded-t-3xl px-4 pb-6 pt-4"
        style={{
          backgroundColor: "var(--surface)",
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">Log activity</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Type chips */}
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const on = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: on ? "var(--accent)" : "var(--surface-alt)",
                  color: on ? "var(--accent-ink)" : "var(--text)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <Field label="When">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={fieldStyle}
          />
        </Field>

        <Field label="Duration (minutes)">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={fieldStyle}
          />
        </Field>

        {showDistance ? (
          <Field label={distanceLabel}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.1}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
          </Field>
        ) : null}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
            className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
            style={fieldStyle}
          />
        </Field>

        {type === "gym" ? (
          <p
            className="rounded-lg px-3 py-2 text-[11px]"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text-muted)",
            }}
          >
            Saving a Gym activity also ticks the Gym habit for that day.
          </p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={submitting}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  backgroundColor: "var(--surface-alt)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
