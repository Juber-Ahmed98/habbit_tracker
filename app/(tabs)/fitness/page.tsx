"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { FitnessHeader } from "@/components/fitness/FitnessHeader";
import { GarminSyncCard } from "@/components/fitness/GarminSyncCard";
import { HydrationCard } from "@/components/fitness/HydrationCard";
import { ManualSessionSheet } from "@/components/fitness/ManualSessionSheet";
import { RecentActivitiesList } from "@/components/fitness/RecentActivitiesList";
import { StepsCard } from "@/components/fitness/StepsCard";
import { HabitCard } from "@/components/habits/HabitCard";
import { Section } from "@/components/ui/Section";
import { useHabitsByCategory, useUncategorisedHabits } from "@/lib/db/hooks";

// §5.2 Fitness — manual-entry pass (build order step 6). The header strip,
// hydration, and steps are owned by Step 6; Strava (Step 7) and BLE (Step 8)
// extend the same components rather than replacing them.
export default function FitnessPage() {
  const [logOpen, setLogOpen] = useState(false);
  const workout = useHabitsByCategory("fitness", "fitness-workout");
  const customs = useUncategorisedHabits("fitness");

  return (
    <section className="space-y-5 pb-6">
      <header>
        <h1 className="text-[28px] font-semibold text-text">Fitness</h1>
        <p className="mt-1 text-xs text-text-muted">
          Log a session, tap the hydration chips, edit steps as you go.
        </p>
      </header>

      <FitnessHeader />

      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
      >
        <Plus size={16} aria-hidden /> Log activity
      </button>

      <Section
        title="Workout"
        icon="dumbbell"
        description="Auto-ticked when you log a Gym session."
      >
        {workout?.map((h) => <HabitCard key={h.id} habit={h} />)}
      </Section>

      <StepsCard />
      <HydrationCard />

      <RecentActivitiesList />

      {customs && customs.length > 0 ? (
        <Section title="Custom" icon="sparkles">
          {customs.map((h) => <HabitCard key={h.id} habit={h} />)}
        </Section>
      ) : null}

      <GarminSyncCard />

      <ManualSessionSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </section>
  );
}
