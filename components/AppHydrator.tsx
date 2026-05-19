"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings";

// Runs once on mount in the (tabs) layout. Reads the persisted Settings
// row from Dexie, applies the theme, and refreshes the localStorage
// pre-paint cache so subsequent loads bootstrap to the right palette.
export function AppHydrator() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
