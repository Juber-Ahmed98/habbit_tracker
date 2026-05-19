import { differenceInCalendarDays, parseISO, subDays } from "date-fns";
import { type Completion, type StreakSnapshot } from "../db/schema";
import { toLocalDateString } from "../utils/date";

// Step 2: minimal streak — count consecutive completed days up to today,
// or up to yesterday if today isn't yet completed (lets the streak survive
// until end-of-day). Step 4 replaces this with the full §7 logic that
// understands scheduled-days and freeze-day carve-outs.
export function computeStreak(
  habitId: string,
  completions: Completion[],
): StreakSnapshot {
  if (completions.length === 0) {
    return { habitId, current: 0, longest: 0, lastCompletedDate: "" };
  }

  const dates = Array.from(new Set(completions.map((c) => c.date))).sort();
  const lastCompletedDate = dates[dates.length - 1];

  // Longest run anywhere in history.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const gap = differenceInCalendarDays(
      parseISO(dates[i]),
      parseISO(dates[i - 1]),
    );
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak — anchor at today or yesterday.
  const today = toLocalDateString();
  const yesterday = toLocalDateString(subDays(new Date(), 1));
  const dateSet = new Set(dates);
  let cursor = dateSet.has(today)
    ? today
    : dateSet.has(yesterday)
      ? yesterday
      : null;

  let current = 0;
  while (cursor && dateSet.has(cursor)) {
    current += 1;
    cursor = toLocalDateString(subDays(parseISO(cursor), 1));
  }

  return { habitId, current, longest, lastCompletedDate };
}
