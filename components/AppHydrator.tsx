"use client";

import { useEffect } from "react";
import { maybeAutoBackup } from "@/lib/backup/sync";
import { ensureFitnessSeed } from "@/lib/db/seed";
import { subscribeBackupAuth } from "@/lib/stores/backup";
import { useSettingsStore } from "@/lib/stores/settings";
import { syncStravaActivities } from "@/lib/strava/sync";

// Min interval between background syncs on app open. Matches the user-facing
// "Refresh now" semantics — manual taps always run; auto-sync only fires if
// the cache is genuinely stale.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Mounts at the root layout. Hydrates the Settings store from Dexie so the
// theme, start-of-week, enabledTabs etc. are available everywhere on first
// paint. Catalogue seeding has moved into the onboarding flow (§10, Step 5).
// Step 6 also runs a one-off Fitness backfill so installs from earlier steps
// pick up the Gym habit; the helper is no-op once a fitness habit exists.
// Step 7: kicks off a debounced Strava sync after hydration when connected.
// Step 11a: subscribes to Supabase auth and triggers a once-daily backup.
export function AppHydrator() {
  const hydrate = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    // Idempotent — starts the supabase.auth subscription once per page load.
    // Safe to call before hydrate() because it gates on isSupabaseConfigured.
    subscribeBackupAuth();
    void (async () => {
      await hydrate();
      await ensureFitnessSeed();

      const strava = useSettingsStore.getState().settings.strava;
      if (strava?.connected) {
        const age = Date.now() - (strava.lastSyncAt ?? 0);
        if (age >= AUTO_SYNC_INTERVAL_MS) {
          // Fire-and-forget; sync handles its own concurrency + error path.
          void syncStravaActivities();
        }
      }

      // Daily auto-backup. maybeAutoBackup quietly no-ops when the user
      // isn't signed in or the local marker is fresh.
      void maybeAutoBackup();
    })();
  }, [hydrate]);
  return null;
}
