"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HabitCard } from "@/components/habits/HabitCard";
import { ensureDeenStateSeed, getDb } from "@/lib/db";
import { useHabitsByCategory } from "@/lib/db/hooks";
import {
  DEFAULT_DEEN_STATE,
  type DeenState,
} from "@/lib/db/schema";
import { toLocalDateString } from "@/lib/utils/date";

const JUZ_NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1);

// Cycle order for the Hifdh map tap interaction.
const NEXT_STATUS: Record<
  "untouched" | "in-progress" | "complete",
  "untouched" | "in-progress" | "complete"
> = {
  untouched: "in-progress",
  "in-progress": "complete",
  complete: "untouched",
};

async function mutateDeenState(
  patch: (s: DeenState) => DeenState,
): Promise<void> {
  const current = await ensureDeenStateSeed();
  const next = patch(current);
  await getDb().deenState.put(next);
}

export function HifdhCard() {
  const today = useMemo(() => toLocalDateString(), []);
  const state = useLiveQuery(
    () => getDb().deenState.get("singleton"),
    [],
  );
  const effective = state ?? DEFAULT_DEEN_STATE;
  const persisted = effective.hifdhNotesByDate?.[today] ?? "";
  const juzStatus = effective.hifdh?.juzStatus ?? {};

  // Local mirror so typing is responsive; debounce writes by 400ms.
  const [draft, setDraft] = useState("");
  const userTouched = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userTouched.current) setDraft(persisted);
  }, [persisted]);

  const onChangeNotes = (text: string) => {
    userTouched.current = true;
    setDraft(text);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void mutateDeenState((s) => ({
        ...s,
        hifdhNotesByDate: { ...s.hifdhNotesByDate, [today]: text },
      }));
    }, 400);
  };

  const cycleJuz = (n: number) => {
    void mutateDeenState((s) => {
      const cur =
        (s.hifdh.juzStatus[n] as "in-progress" | "complete" | undefined) ??
        "untouched";
      const nextStatus = NEXT_STATUS[cur];
      const nextMap = { ...s.hifdh.juzStatus };
      if (nextStatus === "untouched") {
        delete nextMap[n];
      } else {
        nextMap[n] = nextStatus;
      }
      return { ...s, hifdh: { ...s.hifdh, juzStatus: nextMap } };
    });
  };

  // The revision toggle is a real habit — render its HabitCard so streaks
  // & long-press edit work without bespoke wiring.
  const revisionHabits = useHabitsByCategory("deen", "deen-memorization");
  const revisionHabit = revisionHabits?.[0];

  return (
    <article
      className="deen-card relative overflow-hidden p-4"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
      }}
    >
      <header className="mb-3 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
          }}
        >
          <Sparkles size={18} />
        </span>
        <div>
          <h2 className="text-[18px] font-semibold leading-tight">Hifdh</h2>
          <p
            className="text-xs leading-tight"
            style={{ color: "var(--text-muted)" }}
          >
            Memorisation & revision
          </p>
        </div>
      </header>

      {/* New memorisation — free-text journal for today */}
      <div
        className="mb-3 rounded-xl px-3 py-2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <label
          htmlFor="hifdh-new"
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          New memorisation today
        </label>
        <textarea
          id="hifdh-new"
          value={draft}
          onChange={(e) => onChangeNotes(e.target.value)}
          rows={2}
          placeholder="e.g. An-Nāziʿāt 1–10"
          className="w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>

      {/* Revision toggle (real habit) */}
      <div className="mb-3">
        {revisionHabit ? (
          <HabitCard habit={revisionHabit} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Loading revision toggle…
          </p>
        )}
      </div>

      {/* Memorisation map — 30 Juz, tap to cycle status */}
      <div>
        <p
          className="mb-2 text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Memorisation map · tap a Juz to cycle status
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {JUZ_NUMBERS.map((n) => {
            const status =
              (juzStatus[n] as "in-progress" | "complete" | undefined) ??
              "untouched";
            const bg =
              status === "complete"
                ? "var(--accent)"
                : status === "in-progress"
                  ? "var(--surface-alt)"
                  : "transparent";
            const fg =
              status === "complete"
                ? "var(--accent-ink)"
                : "var(--text)";
            const border =
              status === "in-progress"
                ? "2px solid var(--accent)"
                : "1px solid var(--border)";
            return (
              <button
                key={n}
                type="button"
                onClick={() => cycleJuz(n)}
                aria-label={`Juz ${n}, ${status}`}
                className="flex h-9 items-center justify-center rounded-lg text-xs font-semibold"
                style={{
                  backgroundColor: bg,
                  color: fg,
                  border,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div
          className="mt-2 flex flex-wrap gap-3 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded"
              style={{ border: "1px solid var(--border)" }}
            />
            Untouched
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded"
              style={{
                backgroundColor: "var(--surface-alt)",
                border: "2px solid var(--accent)",
              }}
            />
            In progress
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: "var(--accent)" }}
            />
            Complete
          </span>
        </div>
      </div>
    </article>
  );
}
