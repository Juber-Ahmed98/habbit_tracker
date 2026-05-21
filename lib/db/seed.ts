"use client";

import { ensureSettingsSeed, getDb } from "./index";
import { type Habit, type HabitTab } from "./schema";

// Structural habit catalogue offered on first run. From Step 5 onwards the
// onboarding flow (§10) drives this selection — `ensureCatalogueSeed` remains
// as a fallback for users who skip onboarding entirely (the flow always sets
// `catalogueSeeded: true` so this returns immediately for them).
//
// Category strings are namespaced `<tab>-<group>` so each tab page can pull
// its sections via a Dexie equality query.

export type CatalogueRow = {
  // Stable key used by the onboarding selector. Don't reuse — adding a new
  // habit means adding a new key; renaming a habit should keep the old key.
  key: string;
  tab: HabitTab;
  category: string;
  name: string;
  icon: string;
};

export const CATALOGUE: CatalogueRow[] = [
  // Fitness — Workout
  { key: "fitness-gym", tab: "fitness", category: "fitness-workout", name: "Gym / Workout", icon: "dumbbell" },

  // Work — Focus
  { key: "work-pomodoro", tab: "work", category: "work-focus", name: "Pomodoro", icon: "timer" },
  { key: "work-skill", tab: "work", category: "work-focus", name: "Skill building", icon: "bookOpen" },
  // Work — Productivity
  { key: "work-inbox", tab: "work", category: "work-productivity", name: "Inbox Zero", icon: "inbox" },
  { key: "work-planning", tab: "work", category: "work-productivity", name: "Daily planning", icon: "briefcase" },

  // Lifestyle — Skincare
  { key: "lifestyle-skincare-am", tab: "lifestyle", category: "lifestyle-skincare", name: "Morning skincare", icon: "sun" },
  { key: "lifestyle-skincare-pm", tab: "lifestyle", category: "lifestyle-skincare", name: "Evening skincare", icon: "moon" },
  // Lifestyle — Sleep
  { key: "lifestyle-winddown", tab: "lifestyle", category: "lifestyle-sleep", name: "Wind-down by 10pm", icon: "moon" },
  // Lifestyle — Diet
  { key: "lifestyle-clean-eating", tab: "lifestyle", category: "lifestyle-diet", name: "Clean eating", icon: "leaf" },
  { key: "lifestyle-no-sugar", tab: "lifestyle", category: "lifestyle-diet", name: "No sugar", icon: "leaf" },

  // Deen
  { key: "deen-tilawah", tab: "deen", category: "deen-reading", name: "Read Quran today", icon: "bookOpen" },
  { key: "deen-revision", tab: "deen", category: "deen-memorization", name: "Revised memorisation", icon: "sparkles" },
];

// Materialise selected catalogue rows as Habit records. Does NOT touch the
// `catalogueSeeded` flag — callers are responsible for marking the seed done.
export async function seedCatalogueRows(rows: CatalogueRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  const now = Date.now();
  const existingCount = await db.habits.count();
  const habits: Habit[] = rows.map((row, i) => ({
    id: crypto.randomUUID(),
    tab: row.tab,
    category: row.category,
    name: row.name,
    icon: row.icon,
    type: "toggle",
    schedule: { days: [0, 1, 2, 3, 4, 5, 6] },
    createdAt: now,
    // Append after any existing rows so onboarding seeds don't collide with
    // habits a user manually added before completing onboarding.
    order: existingCount + i + 1,
  }));
  await db.habits.bulkPut(habits);
}

// Legacy fallback — kept for installs where onboarding never ran (e.g. older
// builds before Step 5). New installs go through onboarding which sets
// `catalogueSeeded` directly. Idempotent.
export async function ensureCatalogueSeed(): Promise<void> {
  const db = getDb();
  const settings = await ensureSettingsSeed();
  if (settings.catalogueSeeded) return;

  await db.transaction("rw", db.habits, db.settings, async () => {
    await seedCatalogueRows(CATALOGUE);
    await db.settings.put({ ...settings, catalogueSeeded: true });
  });
}

// Step 6 one-off: existing installs already have `catalogueSeeded: true` from
// Step 3/5, so the Gym row added to CATALOGUE this step never reaches them.
// Backfill it here — only when there are zero fitness-tab habits, so users
// who deliberately deleted/customised it aren't re-seeded.
//
// Safe to call on every app open: if catalogue isn't seeded yet, defer to
// onboarding; if any fitness habit exists, do nothing.
export async function ensureFitnessSeed(): Promise<void> {
  const settings = await ensureSettingsSeed();
  if (!settings.catalogueSeeded) return; // onboarding will handle it
  const db = getDb();
  const existing = await db.habits.where("tab").equals("fitness").count();
  if (existing > 0) return;
  const gym = CATALOGUE.find((r) => r.key === "fitness-gym");
  if (!gym) return;
  await seedCatalogueRows([gym]);
}
