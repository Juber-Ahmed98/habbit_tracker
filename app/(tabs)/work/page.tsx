"use client";

import { HabitCard } from "@/components/habits/HabitCard";
import { Section } from "@/components/ui/Section";
import { useHabitsByCategory, useUncategorisedHabits } from "@/lib/db/hooks";
import { DailyPlanField } from "@/components/work/DailyPlanField";

// §5.3 Work — sparse single column, lots of whitespace. Pomodoro / Skill
// building render as toggle stubs in Step 3; real timer + Web Audio chime
// lands in a later step (timer wiring isn't in §13.3 "manual ticking only").
export default function WorkPage() {
  const focus = useHabitsByCategory("work", "work-focus");
  const productivity = useHabitsByCategory("work", "work-productivity");
  const customs = useUncategorisedHabits("work");

  return (
    <section className="space-y-6 pb-6">
      <header>
        <h1 className="text-[28px] font-semibold text-text">Work</h1>
        <p className="mt-1 text-xs text-text-muted">
          Single-column on purpose. Tap to tick.
        </p>
      </header>

      <Section
        title="Focus"
        icon="timer"
        description="Deep-work blocks. Long-press to edit."
      >
        {focus?.map((h) => <HabitCard key={h.id} habit={h} />)}
      </Section>

      <Section
        title="Productivity"
        icon="briefcase"
        description="Daily admin & planning."
      >
        {productivity?.map((h) => <HabitCard key={h.id} habit={h} />)}
        <DailyPlanField />
      </Section>

      {customs && customs.length > 0 ? (
        <Section title="Custom" icon="sparkles">
          {customs.map((h) => <HabitCard key={h.id} habit={h} />)}
        </Section>
      ) : null}
    </section>
  );
}
