"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings";

// Mount once at the root layout. Waits for the Settings store to hydrate,
// then redirects to /onboarding the first time the user lands anywhere
// outside that flow without an `onboardingCompletedAt` timestamp. The
// onboarding page itself sets the timestamp on Finish or Skip, so we never
// loop a returning user.
export function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useSettingsStore((s) => s.hydrated);
  const onboardingCompletedAt = useSettingsStore(
    (s) => s.settings.onboardingCompletedAt,
  );

  useEffect(() => {
    if (!hydrated) return;
    if (onboardingCompletedAt) return;
    if (pathname.startsWith("/onboarding")) return;
    router.replace("/onboarding");
  }, [hydrated, onboardingCompletedAt, pathname, router]);

  return null;
}
