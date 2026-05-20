"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNowStrict } from "date-fns";
import { BookOpen, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ensureDeenStateSeed, getDb } from "@/lib/db";
import {
  type DeenState,
  DEFAULT_DEEN_STATE,
} from "@/lib/db/schema";
import {
  getSurah,
  juzForPosition,
  SURAHS,
} from "@/lib/deen/quran";
import { toLocalDateString } from "@/lib/utils/date";

// Mutates DeenState through the singleton — Dexie's put-with-fresh-read
// keeps writes consistent (we're the only writer of this row).
async function mutateDeenState(
  patch: (s: DeenState) => DeenState,
): Promise<void> {
  const current = await ensureDeenStateSeed();
  const next = patch(current);
  await getDb().deenState.put(next);
}

export function TilawahCard() {
  const today = useMemo(() => toLocalDateString(), []);
  const state = useLiveQuery(
    () => getDb().deenState.get("singleton"),
    [],
  );
  const effective = state ?? DEFAULT_DEEN_STATE;
  const { currentSurah, currentAyah, lastOpenedAt } = effective.quran;
  const pagesToday = effective.pagesReadByDate?.[today] ?? 0;

  const surah = getSurah(currentSurah);
  const juz = juzForPosition(currentSurah, currentAyah);

  const [navOpen, setNavOpen] = useState(false);
  const [selSurah, setSelSurah] = useState(currentSurah);
  const [selAyah, setSelAyah] = useState(currentAyah);

  // Keep the navigator's local selection synced with the persisted value
  // when the card first loads / state changes externally.
  // (Cheap because both vars are primitives.)
  if (!navOpen && (selSurah !== currentSurah || selAyah !== currentAyah)) {
    setSelSurah(currentSurah);
    setSelAyah(currentAyah);
  }

  const bumpPages = (delta: number) => {
    void mutateDeenState((s) => {
      const next = Math.max(0, (s.pagesReadByDate?.[today] ?? 0) + delta);
      return {
        ...s,
        quran: { ...s.quran, lastOpenedAt: Date.now() },
        pagesReadByDate: { ...s.pagesReadByDate, [today]: next },
      };
    });
  };

  const saveNavigator = () => {
    const target = getSurah(selSurah);
    if (!target) return;
    const safeAyah = Math.min(Math.max(1, selAyah), target.ayat);
    void mutateDeenState((s) => ({
      ...s,
      quran: {
        currentJuz: juzForPosition(selSurah, safeAyah),
        currentSurah: selSurah,
        currentAyah: safeAyah,
        lastOpenedAt: Date.now(),
      },
    }));
    setNavOpen(false);
  };

  const lastOpenedLabel = lastOpenedAt
    ? `Last opened ${formatDistanceToNowStrict(new Date(lastOpenedAt), { addSuffix: true })}`
    : "Not opened yet";

  return (
    <article
      className="deen-card relative overflow-hidden p-4"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
      }}
    >
      <header className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
            }}
          >
            <BookOpen size={18} />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold leading-tight">
              Tilawah
            </h2>
            <p
              className="text-xs leading-tight"
              style={{ color: "var(--text-muted)" }}
            >
              Quran reading
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          className="rounded-lg px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
          }}
        >
          {navOpen ? "Cancel" : "Go to…"}
        </button>
      </header>

      {navOpen ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Surah
            </span>
            <select
              value={selSurah}
              onChange={(e) => setSelSurah(Number(e.target.value))}
              className="w-full rounded-lg px-2 py-1 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              {SURAHS.map((s) => (
                <option key={s.n} value={s.n}>
                  {s.n}. {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Ayah (1–{getSurah(selSurah)?.ayat ?? 1})
            </span>
            <input
              type="number"
              min={1}
              max={getSurah(selSurah)?.ayat ?? 1}
              value={selAyah}
              onChange={(e) => setSelAyah(Number(e.target.value))}
              className="w-full rounded-lg px-2 py-1 text-sm outline-none"
              style={{
                backgroundColor: "var(--surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />
          </label>
          <button
            type="button"
            onClick={saveNavigator}
            className="col-span-2 rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            Save position
          </button>
        </div>
      ) : (
        <div
          className="mb-3 rounded-xl px-3 py-2"
          style={{ backgroundColor: "var(--surface-alt)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Currently on
          </p>
          <p className="text-base font-semibold">
            Juz {juz} · {surah ? `${surah.name} (${surah.n})` : "—"} · Ayah{" "}
            {currentAyah}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {lastOpenedLabel}
          </p>
        </div>
      )}

      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Pages read today
          </p>
          <p className="text-2xl font-semibold leading-none">{pagesToday}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => bumpPages(-1)}
            aria-label="Decrement pages"
            disabled={pagesToday === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={() => bumpPages(1)}
            aria-label="Increment pages"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
