"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings";

// Mounts at the root layout. Hydrates the Settings store from Dexie so the
// theme, start-of-week, enabledTabs etc. are available everywhere on first
// paint. Catalogue seeding has moved into the onboarding flow (§10, Step 5)
// — once `onboardingCompletedAt` is set the gate stops redirecting and the
// rest of the app runs normally.
export function AppHydrator() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
