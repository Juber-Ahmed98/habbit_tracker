"use client";

import { create } from "zustand";
import { ensureSettingsSeed, getDb } from "../db";
import { DEFAULT_SETTINGS, type Settings, type ThemeChoice } from "../db/schema";

type SettingsStore = {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  setTheme: (theme: ThemeChoice) => Promise<void>;
};

// Mirror the persisted theme to localStorage so the pre-paint bootstrap
// in app/layout.tsx can read it synchronously. Dexie stays authoritative.
function syncThemeCache(theme: ThemeChoice) {
  if (typeof window === "undefined") return;
  try {
    if (theme === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", theme);
    }
  } catch {
    // ignore: storage may be unavailable in private mode
  }
}

function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    const seeded = await ensureSettingsSeed();
    set({ settings: seeded, hydrated: true });
    syncThemeCache(seeded.theme);
    applyTheme(seeded.theme);
  },

  async update(patch) {
    const db = getDb();
    const next: Settings = { ...get().settings, ...patch, id: "singleton" };
    await db.settings.put(next);
    set({ settings: next });
    if (patch.theme !== undefined) {
      syncThemeCache(next.theme);
      applyTheme(next.theme);
    }
  },

  async setTheme(theme) {
    await get().update({ theme });
  },
}));
