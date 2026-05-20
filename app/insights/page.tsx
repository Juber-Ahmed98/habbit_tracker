"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BestStreaksList } from "@/components/insights/BestStreaksList";
import { HabitHeatmap } from "@/components/insights/HabitHeatmap";
import { PerTabBreakdown } from "@/components/insights/PerTabBreakdown";
import { SummaryCards } from "@/components/insights/SummaryCards";
import { WeeklyTrendChart } from "@/components/insights/WeeklyTrendChart";

// §5.1 "Tappable → full insights view." Lives outside the (tabs) layout
// so the bottom nav is hidden and the back arrow returns to Dashboard.
export default function InsightsPage() {
  return (
    <main
      className="mx-auto min-h-dvh max-w-md space-y-4 px-4 pt-4"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
      }}
    >
      <header className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[24px] font-semibold text-text">Insights</h1>
      </header>

      <Suspense>
        <SummaryCards />
        <WeeklyTrendChart />
        <PerTabBreakdown />
        <BestStreaksList />
        <HabitHeatmap />
      </Suspense>

      <p
        className="pt-2 text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Garmin sessions arrive in step 7.
      </p>
    </main>
  );
}
