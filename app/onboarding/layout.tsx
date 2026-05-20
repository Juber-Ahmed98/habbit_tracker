import type { ReactNode } from "react";

// Onboarding lives outside the (tabs) group so the bottom nav is hidden and
// the layout is uncluttered. We keep AppHydrator from the root layout so
// settings still load while the user picks options.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      {children}
    </main>
  );
}
