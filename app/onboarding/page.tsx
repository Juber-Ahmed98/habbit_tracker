"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Briefcase,
  Check,
  Dumbbell,
  LayoutDashboard,
  Moon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { HabitIcon } from "@/components/habits/icons";
import { getDb } from "@/lib/db";
import { CATALOGUE, type CatalogueRow, seedCatalogueRows } from "@/lib/db/seed";
import {
  DEFAULT_ENABLED_TABS,
  type EnabledTabs,
  type HabitTab,
  type TabKey,
} from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";

// §10 — 4-step skippable onboarding. Each step is a single screen; the user
// can press "Skip for now" at any point and we still persist whatever they've
// touched so far + mark onboarding complete (so we don't loop them back).

type Step = 1 | 2 | 3 | 4;

type Draft = {
  displayName: string;
  enabledTabs: EnabledTabs;
  // Catalogue row keys the user has selected.
  selectedHabits: Set<string>;
  stepGoal: number;
  hydrationGoalMl: number;
  maxHr?: number;
};

const TAB_OPTIONS: Array<{
  key: Exclude<TabKey, "dashboard">;
  label: string;
  Icon: LucideIcon;
  description: string;
}> = [
  { key: "fitness", label: "Fitness", Icon: Dumbbell, description: "Workouts, steps, hydration." },
  { key: "work", label: "Work", Icon: Briefcase, description: "Focus, planning, skill-building." },
  { key: "deen", label: "Deen", Icon: Moon, description: "Quran reading + memorisation." },
  { key: "lifestyle", label: "Lifestyle", Icon: Sparkles, description: "Skincare, sleep, diet." },
];

const TAB_GROUP_LABEL: Record<HabitTab, string> = {
  fitness: "Fitness",
  work: "Work",
  deen: "Deen",
  lifestyle: "Lifestyle",
};

export default function OnboardingPage() {
  const router = useRouter();
  const update = useSettingsStore((s) => s.update);
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);

  const existingHabits = useLiveQuery(() => getDb().habits.toArray(), []);
  const existingCatalogueKeys = useMemo(() => {
    if (!existingHabits) return new Set<string>();
    // Map a habit back to a catalogue key by matching (tab, category, name).
    const out = new Set<string>();
    for (const h of existingHabits) {
      const row = CATALOGUE.find(
        (r) => r.tab === h.tab && r.category === h.category && r.name === h.name,
      );
      if (row) out.add(row.key);
    }
    return out;
  }, [existingHabits]);

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    displayName: settings.displayName ?? "",
    enabledTabs: { ...DEFAULT_ENABLED_TABS },
    // Pre-tick every catalogue row by default — matches §10 "user can untick".
    selectedHabits: new Set(CATALOGUE.map((r) => r.key)),
    stepGoal: settings.stepGoal,
    hydrationGoalMl: settings.hydrationGoalMl,
    maxHr: settings.maxHr,
  }));

  const visibleCatalogue = useMemo(() => {
    const byTab = new Map<HabitTab, CatalogueRow[]>();
    for (const row of CATALOGUE) {
      // Only show rows for tabs the user kept enabled.
      if (!draft.enabledTabs[row.tab]) continue;
      const list = byTab.get(row.tab) ?? [];
      list.push(row);
      byTab.set(row.tab, list);
    }
    return byTab;
  }, [draft.enabledTabs]);

  function toggleTab(key: Exclude<TabKey, "dashboard">) {
    setDraft((d) => ({
      ...d,
      enabledTabs: { ...d.enabledTabs, [key]: !d.enabledTabs[key] },
    }));
  }

  function toggleHabit(key: string) {
    setDraft((d) => {
      const next = new Set(d.selectedHabits);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, selectedHabits: next };
    });
  }

  async function finalise(opts: { seedHabits: boolean }) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const trimmedName = draft.displayName.trim();
      await update({
        displayName: trimmedName === "" ? undefined : trimmedName,
        enabledTabs: { ...draft.enabledTabs, dashboard: true },
        stepGoal: Math.max(0, Math.round(draft.stepGoal)),
        hydrationGoalMl: Math.max(0, Math.round(draft.hydrationGoalMl)),
        maxHr: draft.maxHr,
        onboardingCompletedAt: Date.now(),
        // Mark seed done either way — if the user skipped, we honour the empty
        // state and don't re-prompt from the legacy ensureCatalogueSeed path.
        catalogueSeeded: true,
      });

      if (opts.seedHabits) {
        const toSeed = CATALOGUE.filter(
          (r) =>
            draft.selectedHabits.has(r.key) &&
            !existingCatalogueKeys.has(r.key) &&
            draft.enabledTabs[r.tab],
        );
        await seedCatalogueRows(toSeed);
      }
      router.replace("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  // Render --------------------------------------------------------------------

  if (!hydrated) {
    return (
      <p className="pt-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </p>
    );
  }

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <StepDots current={step} />
        <button
          type="button"
          onClick={() => void finalise({ seedHabits: false })}
          disabled={submitting}
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Skip for now
        </button>
      </header>

      <div className="flex-1">
        {step === 1 ? (
          <StepWelcome
            draft={draft}
            setDraft={setDraft}
            onToggleTab={toggleTab}
          />
        ) : null}
        {step === 2 ? (
          <StepHabits
            draft={draft}
            visibleByTab={visibleCatalogue}
            existingKeys={existingCatalogueKeys}
            onToggle={toggleHabit}
          />
        ) : null}
        {step === 3 ? <StepGoals draft={draft} setDraft={setDraft} /> : null}
        {step === 4 ? <StepConnections /> : null}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || submitting}
          className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
          }}
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={submitting}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finalise({ seedHabits: true })}
            disabled={submitting}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting ? "Saving…" : "Finish"}
          </button>
        )}
      </div>
    </>
  );
}

// -- Step 1 -----------------------------------------------------------------

function StepWelcome({
  draft,
  setDraft,
  onToggleTab,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onToggleTab: (key: Exclude<TabKey, "dashboard">) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold">Welcome.</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Five tabs cover habits across your day. You can hide any you don&apos;t need.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          What should we call you?
        </span>
        <input
          type="text"
          autoComplete="given-name"
          value={draft.displayName}
          onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
          placeholder="Optional"
          className="mt-1.5 w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Enabled tabs
        </p>
        <div
          className="flex items-center gap-3 rounded-card px-3 py-2.5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <LayoutDashboard size={18} aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-medium">Dashboard</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Always on — the home view for daily progress.
            </p>
          </div>
        </div>
        {TAB_OPTIONS.map(({ key, label, Icon, description }) => {
          const on = draft.enabledTabs[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggleTab(key)}
              className="flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left"
              style={{
                backgroundColor: "var(--surface)",
                border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              <Icon size={18} aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              </div>
              <span
                aria-hidden
                className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor: on ? "var(--accent)" : "transparent",
                  border: on ? "none" : "1px solid var(--neutral-outline)",
                }}
              >
                {on ? <Check size={12} style={{ color: "var(--accent-ink)" }} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// -- Step 2 -----------------------------------------------------------------

function StepHabits({
  draft,
  visibleByTab,
  existingKeys,
  onToggle,
}: {
  draft: Draft;
  visibleByTab: Map<HabitTab, CatalogueRow[]>;
  existingKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  const groups = Array.from(visibleByTab.entries());
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold">Pick a starter set</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Untick anything you don&apos;t want. You can add more later from the Dashboard.
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No tabs enabled — go back and pick at least one.
        </p>
      ) : null}
      {groups.map(([tab, rows]) => (
        <div key={tab} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {TAB_GROUP_LABEL[tab]}
          </p>
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const already = existingKeys.has(row.key);
              const checked = already || draft.selectedHabits.has(row.key);
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => {
                      if (already) return;
                      onToggle(row.key);
                    }}
                    disabled={already}
                    className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-left"
                    style={{
                      backgroundColor: "var(--surface)",
                      border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      opacity: already ? 0.7 : 1,
                    }}
                  >
                    <HabitIcon name={row.icon} size={16} aria-hidden />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{row.name}</p>
                      {already ? (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Already in your library
                        </p>
                      ) : null}
                    </div>
                    <span
                      aria-hidden
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: checked ? "var(--accent)" : "transparent",
                        border: checked ? "none" : "1px solid var(--neutral-outline)",
                      }}
                    >
                      {checked ? <Check size={12} style={{ color: "var(--accent-ink)" }} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// -- Step 3 -----------------------------------------------------------------

function StepGoals({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold">Daily goals</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Sensible defaults — change any time from Settings.
        </p>
      </div>
      <NumberField
        label="Steps per day"
        value={draft.stepGoal}
        onChange={(n) => setDraft((d) => ({ ...d, stepGoal: n }))}
        step={500}
        placeholder="10000"
      />
      <NumberField
        label="Hydration goal (ml)"
        value={draft.hydrationGoalMl}
        onChange={(n) => setDraft((d) => ({ ...d, hydrationGoalMl: n }))}
        step={250}
        placeholder="2500"
      />
      <NumberField
        label="Max heart rate (optional)"
        hint="Used for Live HR zones in step 8. Leave blank if you're not sure."
        value={draft.maxHr ?? 0}
        onChange={(n) => setDraft((d) => ({ ...d, maxHr: n > 0 ? n : undefined }))}
        step={1}
        placeholder="e.g. 190"
        allowZeroAsBlank
      />
    </section>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  step,
  placeholder,
  allowZeroAsBlank,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  placeholder?: string;
  allowZeroAsBlank?: boolean;
}) {
  // Treat 0 as "blank" only for the optional maxHr field so the placeholder
  // shows through. Step/hydration always render their numeric value.
  const display = allowZeroAsBlank && value === 0 ? "" : String(value);
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="mt-1.5 w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: "var(--surface-alt)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      />
      {hint ? (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

// -- Step 4 -----------------------------------------------------------------

function StepConnections() {
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold">Connections</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          These land in upcoming steps — finish onboarding now and wire them up later.
        </p>
      </div>

      <div
        className="space-y-3 rounded-card px-3 py-3"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Strava</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pulls activities into the Fitness tab.
            </p>
          </div>
          <span
            className="rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
            style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}
          >
            Step 7
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Reminders</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Per-habit nudges and an evening summary.
            </p>
          </div>
          <span
            className="rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide"
            style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}
          >
            Cloud sync
          </span>
        </div>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Tap Finish to head to the Dashboard.
      </p>
    </section>
  );
}

// -- Step dots --------------------------------------------------------------

function StepDots({ current }: { current: Step }) {
  // role="progressbar" is the spec-correct way to expose stepwise progress —
  // bare `aria-label` on a generic div is prohibited (axe `aria-prohibited-attr`).
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuetext={`Step ${current} of 4`}
    >
      {([1, 2, 3, 4] as const).map((n) => (
        <span
          key={n}
          aria-hidden
          className="h-1.5 rounded-full transition-all"
          style={{
            width: n === current ? 20 : 8,
            backgroundColor:
              n <= current ? "var(--accent)" : "var(--neutral-outline)",
            opacity: n <= current ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
