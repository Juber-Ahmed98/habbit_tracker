"use client";

import { useEffect } from "react";
import { ensureCatalogueSeed } from "@/lib/db/seed";
import { useSettingsStore } from "@/lib/stores/settings";

// Runs once on mount in the (tabs) layout. Reads the persisted Settings
// row from Dexie, applies the theme, refreshes the localStorage
// pre-paint cache, and ensures the Step 3 structural habit catalogue
// has been seeded (idempotent — guarded by Settings.catalogueSeeded).
export function AppHydrator() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    void (async () => {
      await hydrate();
      await ensureCatalogueSeed();
    })();
  }, [hydrate]);
  return null;
}
