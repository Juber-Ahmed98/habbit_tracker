"use client";

import { ChevronLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { FitSourceCard } from "@/components/fitness/FitSourceCard";
import { StravaSourceCard } from "@/components/fitness/StravaSourceCard";
import { BackupCard } from "@/components/settings/BackupCard";
import {
  type EnabledTabs,
  type TabKey,
  type ThemeChoice,
} from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";

// §11 (subset for Step 5). Just the toggles needed now: theme, start-of-week,
// per-tab visibility, notifications placeholder, and a dev-only reset that
// re-triggers the onboarding flow so we can verify it on a hydrated install.
// Units / profile / cloud sync / exports land in their own steps.

const TAB_LABELS: Record<Exclude<TabKey, "dashboard">, string> = {
  fitness: "Fitness",
  work: "Work",
  deen: "Deen",
  lifestyle: "Lifestyle",
};

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsPage() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [resetting, setResetting] = useState(false);

  async function setEnabledTab(key: Exclude<TabKey, "dashboard">, on: boolean) {
    const next: EnabledTabs = {
      ...settings.enabledTabs,
      [key]: on,
      dashboard: true,
    };
    await update({ enabledTabs: next });
  }

  async function resetOnboarding() {
    if (resetting) return;
    setResetting(true);
    try {
      // Clear both gates so the user re-walks the flow once. We deliberately
      // leave existing habits alone — the catalogue selector pre-ticks them.
      await update({
        onboardingCompletedAt: undefined,
        catalogueSeeded: false,
      });
      router.replace("/onboarding");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main
      className="mx-auto min-h-dvh max-w-md space-y-5 px-4 pt-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      <header className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[24px] font-semibold text-text">Settings</h1>
      </header>

      {/* Theme ------------------------------------------------------------- */}
      <SettingsCard title="Theme">
        <div
          className="flex rounded-xl p-1"
          style={{ backgroundColor: "var(--surface-alt)" }}
        >
          {THEME_OPTIONS.map((opt) => {
            const on = settings.theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => void update({ theme: opt.value })}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--text)" : "var(--text-muted)",
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Week start -------------------------------------------------------- */}
      <SettingsCard title="Start of week">
        <div
          className="flex rounded-xl p-1"
          style={{ backgroundColor: "var(--surface-alt)" }}
        >
          {[
            { value: 1 as const, label: "Monday" },
            { value: 0 as const, label: "Sunday" },
          ].map((opt) => {
            const on = settings.startOfWeek === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => void update({ startOfWeek: opt.value })}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--text)" : "var(--text-muted)",
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Tabs -------------------------------------------------------------- */}
      <SettingsCard
        title="Enabled tabs"
        hint="Dashboard is always on. Hidden tabs disappear from the bottom nav."
      >
        <ul className="space-y-2">
          {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map(
            (key) => {
              const on = settings.enabledTabs[key];
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => void setEnabledTab(key, !on)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "var(--surface-alt)",
                      color: "var(--text)",
                    }}
                  >
                    <span>{TAB_LABELS[key]}</span>
                    <Toggle on={on} />
                  </button>
                </li>
              );
            },
          )}
        </ul>
      </SettingsCard>

      {/* Strava ------------------------------------------------------------ */}
      <Suspense
        fallback={
          <section
            className="rounded-card px-3 py-3"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Fitness sources · Strava
            </p>
          </section>
        }
      >
        <StravaSourceCard />
      </Suspense>

      {/* FIT file import --------------------------------------------------- */}
      <FitSourceCard />

      {/* Cloud backup ------------------------------------------------------ */}
      <Suspense fallback={null}>
        <BackupCard />
      </Suspense>

      {/* Notifications ----------------------------------------------------- */}
      <SettingsCard
        title="Notifications"
        hint="Reminders arrive with cloud sync (step 11). Toggle is disabled until then."
      >
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text-muted)",
          }}
          aria-disabled="true"
        >
          <span>Enable reminders</span>
          <Toggle on={false} />
        </div>
      </SettingsCard>

      {/* Dev / reset ------------------------------------------------------- */}
      <SettingsCard
        title="Reset onboarding"
        hint="Re-walks the welcome flow. Existing habits are kept; the catalogue picker pre-ticks them."
      >
        <button
          type="button"
          onClick={() => void resetOnboarding()}
          disabled={resetting}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          <RefreshCw size={14} aria-hidden />
          {resetting ? "Resetting…" : "Restart onboarding"}
        </button>
      </SettingsCard>

      <p
        className="pt-2 text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Units and exports arrive in later steps.
      </p>
    </main>
  );
}

// -- pieces ------------------------------------------------------------------

function SettingsCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="space-y-2 rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </p>
      {children}
      {hint ? (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      ) : null}
    </section>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="relative inline-block h-5 w-9 rounded-full transition-colors"
      style={{
        backgroundColor: on ? "var(--accent)" : "var(--neutral-outline)",
        opacity: on ? 1 : 0.5,
      }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
        style={{ left: on ? 18 : 2 }}
      />
    </span>
  );
}
