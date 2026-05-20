"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "./index";
import { type Habit, type HabitTab } from "./schema";

// Live habit list filtered by tab + (optional) category. Sorted by `order`.
// Categories index landed in v2 so equality queries are O(log n).
export function useHabitsByCategory(
  tab: HabitTab,
  category: string,
): Habit[] | undefined {
  return useLiveQuery(
    () =>
      getDb()
        .habits.where({ tab, category })
        .filter((h) => !h.archivedAt)
        .sortBy("order"),
    [tab, category],
  );
}

// Habits in this tab that have NO category — i.e. user-created customs
// from the global Add button. Renders in a "Custom" section per tab.
export function useUncategorisedHabits(tab: HabitTab): Habit[] | undefined {
  return useLiveQuery(
    () =>
      getDb()
        .habits.where("tab")
        .equals(tab)
        .filter((h) => !h.archivedAt && !h.category)
        .sortBy("order"),
    [tab],
  );
}
