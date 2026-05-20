"use client";

import { ensureSettingsSeed, getDb } from "./index";
import { type Habit, type HabitTab } from "./schema";

// Structural habit catalogue seeded once on first run. After the
// `catalogueSeeded` flag is set we never re-seed — if the user deletes
// "Pomodoro" they shouldn't see it come back. The user can re-add anything
// via the Add button on Dashboard.
//
// Category strings are namespaced `<tab>-<group>` so each tab page can pull
// its sections via a Dexie equality query.

type CatalogueRow = {
  tab: HabitTab;
  category: string;
  name: string;
  icon: string;
};

const CATALOGUE: CatalogueRow[] = [
  // Work — Focus
  { tab: "work", category: "work-focus", name: "Pomodoro", icon: "timer" },
  {
    tab: "work",
    category: "work-focus",
    name: "Skill building",
    icon: "bookOpen",
  },
  // Work — Productivity
  {
    tab: "work",
    category: "work-productivity",
    name: "Inbox Zero",
    icon: "inbox",
  },
  {
    tab: "work",
    category: "work-productivity",
    name: "Daily planning",
    icon: "briefcase",
  },

  // Lifestyle — Skincare
  {
    tab: "lifestyle",
    category: "lifestyle-skincare",
    name: "Morning skincare",
    icon: "sun",
  },
  {
    tab: "lifestyle",
    category: "lifestyle-skincare",
    name: "Evening skincare",
    icon: "moon",
  },
  // Lifestyle — Sleep
  {
    tab: "lifestyle",
    category: "lifestyle-sleep",
    name: "Wind-down by 10pm",
    icon: "moon",
  },
  // Lifestyle — Diet
  {
    tab: "lifestyle",
    category: "lifestyle-diet",
    name: "Clean eating",
    icon: "leaf",
  },
  {
    tab: "lifestyle",
    category: "lifestyle-diet",
    name: "No sugar",
    icon: "leaf",
  },

  // Deen
  {
    tab: "deen",
    category: "deen-reading",
    name: "Read Quran today",
    icon: "bookOpen",
  },
  {
    tab: "deen",
    category: "deen-memorization",
    name: "Revised memorisation",
    icon: "sparkles",
  },
];

export async function ensureCatalogueSeed(): Promise<void> {
  const db = getDb();
  const settings = await ensureSettingsSeed();
  if (settings.catalogueSeeded) return;

  const now = Date.now();
  const habits: Habit[] = CATALOGUE.map((row, index) => ({
    id: crypto.randomUUID(),
    tab: row.tab,
    category: row.category,
    name: row.name,
    icon: row.icon,
    type: "toggle",
    schedule: { days: [0, 1, 2, 3, 4, 5, 6] },
    createdAt: now,
    order: index + 1,
  }));

  await db.transaction("rw", db.habits, db.settings, async () => {
    await db.habits.bulkPut(habits);
    await db.settings.put({ ...settings, catalogueSeeded: true });
  });
}
