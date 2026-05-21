"use client";

import { useEffect } from "react";
import { ensureFitnessSeed } from "@/lib/db/seed";
import { useSettingsStore } from "@/lib/stores/settings";

// Mounts at the root layout. Hydrates the Settings store from Dexie so the
// theme, start-of-week, enabledTabs etc. are available everywhere on first
// paint. Catalogue seeding has moved into the onboarding flow (§10, Step 5).
// Step 6 also runs a one-off Fitness backfill so installs from earlier steps
// pick up the Gym habit; the helper is no-op once a fitness habit exists.
export function AppHydrator() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    void (async () => {
      await hydrate();
      await ensureFitnessSeed();
    })();
  }, [hydrate]);
  return null;
}
