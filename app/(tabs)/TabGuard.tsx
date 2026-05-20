"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings";
import { type TabKey } from "@/lib/db/schema";

// If the user navigates (or links land) on a tab they disabled in onboarding
// or Settings, send them back to /dashboard. Dashboard is always enabled so
// it's a safe fallback. Runs only after settings have hydrated to avoid a
// flash-of-default-state redirect.
const PATH_TO_TAB: Record<string, TabKey> = {
  "/dashboard": "dashboard",
  "/fitness": "fitness",
  "/work": "work",
  "/deen": "deen",
  "/lifestyle": "lifestyle",
};

export function TabGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const enabledTabs = useSettingsStore((s) => s.settings.enabledTabs);
  const hydrated = useSettingsStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    // Find the longest matching prefix so /fitness/foo also resolves.
    const tab = (Object.keys(PATH_TO_TAB) as Array<keyof typeof PATH_TO_TAB>)
      .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (!tab) return;
    const key = PATH_TO_TAB[tab];
    if (key === "dashboard") return;
    if (!enabledTabs[key]) {
      router.replace("/dashboard");
    }
  }, [hydrated, pathname, enabledTabs, router]);

  return null;
}
