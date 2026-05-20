import { addDays, parseISO, subDays } from "date-fns";
import {
  type Completion,
  type Habit,
  type StreakSnapshot,
} from "../db/schema";
import { toLocalDateString } from "../utils/date";

// Hard cap to keep walking-backward bounded even if dates get weird.
// 10y of daily data is plenty for v1.
const MAX_WALK = 3650;

function isScheduledOn(habit: Habit, date: Date): boolean {
  return habit.schedule.days.includes(date.getDay());
}

// Walks backward day-by-day from `from`. For each day:
//   - if scheduled & completed → streak++, continue
//   - if scheduled & not completed → break
//   - if not scheduled → skip (does not break the streak)
// Stops as soon as we hit an unscheduled missed day OR run out of history.
function walkCurrent(
  habit: Habit,
  doneDates: Set<string>,
  from: Date,
): number {
  let cursor = from;
  let streak = 0;
  for (let i = 0; i < MAX_WALK; i++) {
    if (isScheduledOn(habit, cursor)) {
      const dateStr = toLocalDateString(cursor);
      if (doneDates.has(dateStr)) {
        streak += 1;
      } else {
        break;
      }
    }
    cursor = subDays(cursor, 1);
  }
  return streak;
}

// Full §7 streak compute. The Step 2 implementation didn't know about
// `schedule.days` — this one does, and treats freeze-source completions as
// completed days (the one-per-week constraint is enforced upstream by the
// store, not here).
export function computeStreak(
  habit: Habit,
  completions: Completion[],
): StreakSnapshot {
  if (completions.length === 0) {
    return {
      habitId: habit.id,
      current: 0,
      longest: 0,
      lastCompletedDate: "",
    };
  }

  const doneDates = new Set(completions.map((c) => c.date));
  const sortedDates = Array.from(doneDates).sort();
  const lastCompletedDate = sortedDates[sortedDates.length - 1];

  // ---- current streak ----
  // Anchor at today if it's already done (or today isn't scheduled, in which
  // case we'll just skip it walking back). Otherwise, anchor at yesterday —
  // a scheduled-but-undone today doesn't reset the streak until end-of-day.
  const today = new Date();
  const todayStr = toLocalDateString(today);
  const todayScheduled = isScheduledOn(habit, today);
  const todayDone = doneDates.has(todayStr);

  const anchor =
    todayScheduled && !todayDone ? subDays(today, 1) : today;
  const current = walkCurrent(habit, doneDates, anchor);

  // ---- longest streak ----
  // Walk forward from the earliest completion to today (or last completion,
  // whichever is later). Scheduled-and-done extends the run; scheduled-and-
  // missed resets to zero; unscheduled days are skipped.
  const earliest = parseISO(sortedDates[0]);
  const lastCompleted = parseISO(lastCompletedDate);
  const stopAt = today > lastCompleted ? today : lastCompleted;

  let cursor = earliest;
  let run = 0;
  let longest = 0;
  for (let i = 0; i < MAX_WALK && cursor <= stopAt; i++) {
    if (isScheduledOn(habit, cursor)) {
      const dateStr = toLocalDateString(cursor);
      if (doneDates.has(dateStr)) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }
  // The current trailing run might exceed the historical longest (e.g. first
  // streak ever): make sure longest reflects that.
  if (current > longest) longest = current;

  return {
    habitId: habit.id,
    current,
    longest,
    lastCompletedDate,
  };
}
