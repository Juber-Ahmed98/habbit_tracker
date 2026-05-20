"use client";

import { HabitCard } from "@/components/habits/HabitCard";
import { MealLogField } from "@/components/lifestyle/MealLogField";
import { SleepLogField } from "@/components/lifestyle/SleepLogField";
import { SupplementsList } from "@/components/lifestyle/SupplementsList";
import { Section } from "@/components/ui/Section";
import { useHabitsByCategory, useUncategorisedHabits } from "@/lib/db/hooks";

// §5.5 Lifestyle — categorised list with section headers and small icons.
// All sub-habits use HabitCard so the visual language is consistent.
export default function LifestylePage() {
  const skincare = useHabitsByCategory("lifestyle", "lifestyle-skincare");
  const sleep = useHabitsByCategory("lifestyle", "lifestyle-sleep");
  const diet = useHabitsByCategory("lifestyle", "lifestyle-diet");
  const customs = useUncategorisedHabits("lifestyle");

  return (
    <section className="space-y-6 pb-6">
      <header>
        <h1 className="text-[28px] font-semibold text-text">Lifestyle</h1>
        <p className="mt-1 text-xs text-text-muted">
          Daily routines. Tap to tick, long-press to edit.
        </p>
      </header>

      <Section
        title="Skincare"
        icon="sparkles"
        description="Morning + evening routines."
      >
        {skincare?.map((h) => <HabitCard key={h.id} habit={h} />)}
      </Section>

      <Section
        title="Supplements"
        icon="pill"
        description="Named items you take regularly."
      >
        <SupplementsList
          category="lifestyle-supplements-am"
          title="Morning vitamins"
          icon="sun"
        />
        <SupplementsList
          category="lifestyle-supplements-pm"
          title="Evening minerals"
          icon="moon"
        />
      </Section>

      <Section
        title="Sleep"
        icon="moon"
        description="Time-in, time-out, wind-down."
      >
        <SleepLogField />
        {sleep?.map((h) => <HabitCard key={h.id} habit={h} />)}
      </Section>

      <Section
        title="Diet"
        icon="leaf"
        description="Clean eating and meal notes."
      >
        {diet?.map((h) => <HabitCard key={h.id} habit={h} />)}
        <MealLogField />
      </Section>

      {customs && customs.length > 0 ? (
        <Section title="Custom" icon="sparkles">
          {customs.map((h) => <HabitCard key={h.id} habit={h} />)}
        </Section>
      ) : null}
    </section>
  );
}
