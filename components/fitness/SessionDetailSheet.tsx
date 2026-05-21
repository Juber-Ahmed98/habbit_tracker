"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { Heart, Trash2, X } from "lucide-react";
import { getDb } from "@/lib/db";
import { type FitnessSession } from "@/lib/db/schema";
import { useFitnessStore } from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDistance, formatDuration } from "@/lib/utils/format";

// Minimal Step-6 detail view for a logged FitnessSession. Shows whatever
// metadata is present plus a HR-plot placeholder for when Strava (Step 7)
// or BLE (Step 8) populate `hrSeries`. Delete is destructive — confirmed via
// a single press for now since the row itself is one tap to open.

type Props = {
  sessionId: string | null;
  onClose: () => void;
};

const TYPE_LABEL: Record<FitnessSession["type"], string> = {
  run: "Run",
  ride: "Ride",
  gym: "Gym",
  walk: "Walk",
  swim: "Swim",
  other: "Activity",
};

const SOURCE_LABEL: Record<FitnessSession["source"], string> = {
  manual: "Manual entry",
  strava: "Strava",
  ble: "Live HR monitor",
  fit: "FIT file",
  garmin: "Garmin",
};

export function SessionDetailSheet({ sessionId, onClose }: Props) {
  const units = useSettingsStore((s) => s.settings.units);
  const deleteSession = useFitnessStore((s) => s.deleteSession);

  // Live query so the sheet reflects edits done elsewhere; closes on delete.
  const session = useLiveQuery(
    () => (sessionId ? getDb().fitnessSessions.get(sessionId) : undefined),
    [sessionId],
  );

  if (!sessionId) return null;

  async function handleDelete() {
    if (!session) return;
    await deleteSession(session.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Activity details"
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
          <h2 className="text-[18px] font-semibold">
            {session ? (session.name ?? TYPE_LABEL[session.type]) : "Activity"}
          </h2>
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

        {session === undefined ? (
          <p className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="When" value={format(new Date(session.startedAt), "EEE d MMM, HH:mm")} />
              <Stat label="Type" value={TYPE_LABEL[session.type]} />
              <Stat label="Duration" value={formatDuration(session.durationSec)} />
              <Stat
                label="Distance"
                value={formatDistance(session.distanceM, units) ?? "—"}
              />
              <Stat
                label="Avg HR"
                value={session.avgHr ? `${session.avgHr} bpm` : "—"}
              />
              <Stat
                label="Max HR"
                value={session.maxHr ? `${session.maxHr} bpm` : "—"}
              />
              <Stat
                label="Calories"
                value={session.calories ? `${session.calories} kcal` : "—"}
              />
              <Stat label="Source" value={SOURCE_LABEL[session.source]} />
            </div>

            {session.notes ? (
              <div
                className="rounded-card px-3 py-2"
                style={{
                  backgroundColor: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                }}
              >
                <p
                  className="text-[11px] font-medium uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{session.notes}</p>
              </div>
            ) : null}

            {/* HR plot placeholder — replaced by a real Recharts area chart
                once Strava (Step 7) / BLE (Step 8) populate hrSeries. */}
            <div
              className="rounded-card px-3 py-4 text-center"
              style={{
                backgroundColor: "var(--surface-alt)",
                border: "1px dashed var(--border)",
              }}
            >
              <Heart
                size={18}
                aria-hidden
                className="mx-auto"
                style={{ color: "var(--text-muted)" }}
              />
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                HR plot arrives with Strava / Live HR.
              </p>
            </div>

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
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--surface-alt)",
                  color: "var(--danger)",
                  border: "1px solid var(--danger)",
                }}
              >
                <Trash2 size={14} aria-hidden /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-card px-3 py-2"
      style={{
        backgroundColor: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
