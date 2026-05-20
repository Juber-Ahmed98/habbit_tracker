"use client";

import { HabitCard } from "@/components/habits/HabitCard";
import { HifdhCard } from "@/components/deen/HifdhCard";
import { TilawahCard } from "@/components/deen/TilawahCard";
import { Section } from "@/components/ui/Section";
import { useHabitsByCategory, useUncategorisedHabits } from "@/lib/db/hooks";

// §5.4 Deen — spacious, serene. 20px card radius + parchment overlay
// in light mode (driven by the .deen-card class in globals.css).
// Step 3 ships manual ticking only; richer surahs / ayah analytics later.
export default function DeenPage() {
  const reading = useHabitsByCategory("deen", "deen-reading");
  const customs = useUncategorisedHabits("deen");

  return (
    <section className="space-y-6 pb-6">
      <header>
        <h1 className="text-[28px] font-semibold text-text">Deen</h1>
        <p className="mt-1 text-xs text-text-muted">
          Tilawah and Hifdh.
        </p>
      </header>

      <TilawahCard />

      <Section
        title="Daily tilawah"
        icon="bookOpen"
        description="Tick once you've opened the Mushaf today."
      >
        {reading?.map((h) => <HabitCard key={h.id} habit={h} />)}
      </Section>

      <HifdhCard />

      {customs && customs.length > 0 ? (
        <Section title="Custom" icon="sparkles">
          {customs.map((h) => <HabitCard key={h.id} habit={h} />)}
        </Section>
      ) : null}
    </section>
  );
}
