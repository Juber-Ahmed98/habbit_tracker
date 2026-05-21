"use client";

import { format } from "date-fns";
import { X } from "lucide-react";
import { useState } from "react";
import { type FitnessSession } from "@/lib/db/schema";
import {
  type FitImportCandidate,
  type FitImportPreview,
  type FitImportResolution,
} from "@/lib/fit/import";
import {
  type FitImportSummary,
  useFitnessStore,
} from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDistance, formatDuration } from "@/lib/utils/format";

// Step 9 preview/conflict-resolution sheet. Mounted by FitSourceCard once
// parsing completes; the user picks a resolution per overlapping candidate
// then taps Import.

type Props = {
  preview: FitImportPreview;     // parent only mounts us when there's one
  onClose: () => void;
  onCommitted: (summary: FitImportSummary) => void;
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
  manual: "Manual",
  strava: "Strava",
  ble: "Live HR",
  fit: "FIT",
  garmin: "Garmin",
};

const NEW_OPTIONS: Array<{ value: FitImportResolution; label: string }> = [
  { value: "new", label: "Import" },
  { value: "skip", label: "Skip" },
];

// Conflict options vary by what the conflict is: another FIT row only offers
// replace/skip (merge into yourself is meaningless); a non-FIT conflict
// offers the full merge-or-replace trio.
function optionsFor(
  candidate: FitImportCandidate,
): Array<{ value: FitImportResolution; label: string }> {
  if (!candidate.conflict) return NEW_OPTIONS;
  if (candidate.conflict.source === "fit") {
    return [
      { value: "replace", label: "Replace" },
      { value: "skip", label: "Skip" },
    ];
  }
  return [
    { value: "merge", label: "Merge" },
    { value: "replace", label: "Replace" },
    { value: "skip", label: "Skip" },
  ];
}

export function FitImportSheet({ preview, onClose, onCommitted }: Props) {
  const commit = useFitnessStore((s) => s.commitFitImport);
  const units = useSettingsStore((s) => s.settings.units);

  // Resolution per candidate id. The parent unmounts/remounts us on each new
  // preview (different file pick) so a useState initialiser is enough.
  const [resolutions, setResolutions] = useState<
    Record<string, FitImportResolution>
  >(() => {
    const map: Record<string, FitImportResolution> = {};
    for (const c of preview.candidates) {
      map[c.session.id] = c.defaultResolution;
    }
    return map;
  });
  const [submitting, setSubmitting] = useState(false);

  const candidates = preview.candidates;
  const totalToImport = candidates.filter(
    (c) => resolutions[c.session.id] !== "skip",
  ).length;

  async function handleImport() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const decisions = preview.candidates.map((candidate) => ({
        candidate,
        resolution: resolutions[candidate.session.id] ?? candidate.defaultResolution,
      }));
      const summary = await commit(decisions);
      onCommitted(summary);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="FIT file import preview"
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
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold">Import FIT file</h2>
            <p
              className="truncate text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {preview.fileName}
            </p>
          </div>
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

        {candidates.length === 0 ? (
          <p
            className="rounded-card px-3 py-4 text-sm"
            style={{
              backgroundColor: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            No activities found in this file.
          </p>
        ) : (
          <ul className="space-y-3">
            {candidates.map((c) => {
              const opts = optionsFor(c);
              const chosen =
                resolutions[c.session.id] ?? c.defaultResolution;
              const distance = formatDistance(c.session.distanceM, units);
              return (
                <li
                  key={c.session.id}
                  className="rounded-card px-3 py-3"
                  style={{
                    backgroundColor: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="text-sm font-semibold">
                    {TYPE_LABEL[c.session.type]} ·{" "}
                    {format(new Date(c.session.startedAt), "EEE d MMM, HH:mm")}
                  </p>
                  <p
                    className="mt-0.5 text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDuration(c.session.durationSec)}
                    {distance ? ` · ${distance}` : ""}
                    {c.session.avgHr ? ` · ${c.session.avgHr} bpm avg` : ""}
                    {c.session.maxHr ? ` · ${c.session.maxHr} max` : ""}
                  </p>

                  {c.conflict ? (
                    <p
                      className="mt-2 rounded-lg px-2 py-1 text-[11px]"
                      style={{
                        backgroundColor: "var(--surface)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Overlaps an existing {SOURCE_LABEL[c.conflict.source]}{" "}
                      activity (
                      {formatDuration(c.conflict.durationSec)}
                      {c.conflict.avgHr ? `, ${c.conflict.avgHr} bpm` : ""}
                      ).
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {opts.map((opt) => {
                      const on = chosen === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setResolutions((prev) => ({
                              ...prev,
                              [c.session.id]: opt.value,
                            }))
                          }
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: on
                              ? "var(--accent)"
                              : "var(--surface)",
                            color: on
                              ? "var(--accent-ink)"
                              : "var(--text)",
                            border: `1px solid ${
                              on ? "var(--accent)" : "var(--border)"
                            }`,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex gap-2 pt-1">
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
            onClick={() => void handleImport()}
            disabled={submitting || candidates.length === 0}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting
              ? "Importing…"
              : totalToImport === 0
                ? "Nothing selected"
                : `Import ${totalToImport}`}
          </button>
        </div>
      </div>
    </div>
  );
}
