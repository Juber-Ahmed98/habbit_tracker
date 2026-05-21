"use client";

import { addDays, startOfWeek } from "date-fns";
import { create } from "zustand";
import { getDb } from "../db";
import {
  type CompletionSource,
  type Habit,
  type HabitTab,
  type HabitType,
} from "../db/schema";
import { milestoneCrossed } from "../haptics";
import { computeStreak } from "../streaks/compute";
import { useSettingsStore } from "./settings";
import { toLocalDateString } from "../utils/date";

export type CreateHabitInput = {
  tab: HabitTab;
  category?: string;
  name: string;
  icon: string;
  type: HabitType;
  target?: number;
  unit?: string;
  scheduleDays?: number[];
  scheduleTime?: string;
};

export type FreezeApplyResult =
  | "applied"
  | "already-completed"
  | "already-frozen-this-week";

// toggleHabit's return surfaces the streak boundary just crossed so the
// caller (HabitCard) can choose between HAPTIC_TAP and HAPTIC_MILESTONE.
// `ticked: false` = the tap unticked an existing completion.
export type ToggleHabitResult = {
  ticked: boolean;
  crossedMilestone: number | null;
};

type HabitsStore = {
  // Transient UI state — the habit being edited via the long-press sheet.
  editingHabitId: string | null;
  setEditingHabitId: (id: string | null) => void;

  // Commands. All writes funnel through here so future Step 5 notification
  // re-registration can hook in one place.
  createHabit: (input: CreateHabitInput) => Promise<string>;
  updateHabit: (id: string, patch: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  tickHabit: (
    habitId: string,
    date?: string,
    source?: CompletionSource,
  ) => Promise<void>;
  untickHabit: (habitId: string, date?: string) => Promise<void>;
  toggleHabit: (
    habitId: string,
    date?: string,
  ) => Promise<ToggleHabitResult>;
  applyFreezeDay: (habitId: string) => Promise<FreezeApplyResult>;
  removeFreezeDay: (habitId: string) => Promise<void>;
};

// Recompute snapshot. Now needs the Habit row so the §7 logic can see
// schedule.days — older callers passed just the id.
async function refreshStreak(habitId: string) {
  const db = getDb();
  const habit = await db.habits.get(habitId);
  if (!habit) return;
  const completions = await db.completions
    .where("habitId")
    .equals(habitId)
    .toArray();
  const snapshot = computeStreak(habit, completions);
  await db.streakSnapshots.put(snapshot);
}

// Calendar week boundary used by the freeze-per-week rule. Follows
// Settings.startOfWeek so this matches whatever the WeekStrip displays.
function currentWeekRange(): { startStr: string; endStr: string } {
  const startOn = useSettingsStore.getState().settings.startOfWeek;
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: startOn });
  const end = addDays(start, 6);
  return {
    startStr: toLocalDateString(start),
    endStr: toLocalDateString(end),
  };
}

export const useHabitsStore = create<HabitsStore>((set) => ({
  editingHabitId: null,
  setEditingHabitId: (id) => set({ editingHabitId: id }),

  async createHabit(input) {
    const db = getDb();
    const id = crypto.randomUUID();
    const maxOrder = await db.habits
      .where("tab")
      .equals(input.tab)
      .reverse()
      .sortBy("order")
      .then((rows) => rows[0]?.order ?? 0);
    const habit: Habit = {
      id,
      tab: input.tab,
      category: input.category,
      name: input.name,
      icon: input.icon,
      type: input.type,
      target: input.target,
      unit: input.unit,
      schedule: {
        days: input.scheduleDays ?? [0, 1, 2, 3, 4, 5, 6],
        timeOfDay: input.scheduleTime,
      },
      createdAt: Date.now(),
      order: maxOrder + 1,
    };
    await db.habits.put(habit);
    return id;
  },

  async updateHabit(id, patch) {
    const db = getDb();
    await db.habits.update(id, patch);
    // Schedule changes alter what counts as "scheduled" — recompute snapshot.
    if (patch.schedule) {
      await refreshStreak(id);
    }
  },

  async deleteHabit(id) {
    const db = getDb();
    await db.transaction(
      "rw",
      db.habits,
      db.completions,
      db.streakSnapshots,
      async () => {
        await db.completions.where("habitId").equals(id).delete();
        await db.streakSnapshots.delete(id);
        await db.habits.delete(id);
      },
    );
  },

  async tickHabit(habitId, date, source = "manual") {
    const db = getDb();
    const dateStr = date ?? toLocalDateString();
    const existing = await db.completions
      .where("[habitId+date]")
      .equals([habitId, dateStr])
      .first();
    if (existing) return;
    await db.completions.put({
      id: crypto.randomUUID(),
      habitId,
      date: dateStr,
      completedAt: Date.now(),
      source,
    });
    await refreshStreak(habitId);
  },

  async untickHabit(habitId, date) {
    const db = getDb();
    const dateStr = date ?? toLocalDateString();
    await db.completions
      .where("[habitId+date]")
      .equals([habitId, dateStr])
      .delete();
    await refreshStreak(habitId);
  },

  async toggleHabit(habitId, date) {
    const db = getDb();
    const dateStr = date ?? toLocalDateString();
    const existing = await db.completions
      .where("[habitId+date]")
      .equals([habitId, dateStr])
      .first();
    if (existing) {
      await db.completions.delete(existing.id);
      await refreshStreak(habitId);
      return { ticked: false, crossedMilestone: null };
    }
    // Snapshot the streak before the new tick so we can detect crossings.
    const prevStreak = (await db.streakSnapshots.get(habitId))?.current ?? 0;
    await db.completions.put({
      id: crypto.randomUUID(),
      habitId,
      date: dateStr,
      completedAt: Date.now(),
      source: "manual",
    });
    await refreshStreak(habitId);
    const nextStreak = (await db.streakSnapshots.get(habitId))?.current ?? 0;
    return {
      ticked: true,
      crossedMilestone: milestoneCrossed(prevStreak, nextStreak),
    };
  },

  async applyFreezeDay(habitId) {
    const db = getDb();
    const todayStr = toLocalDateString();
    const { startStr, endStr } = currentWeekRange();

    // Check today first — no point spending a freeze on an already-done day.
    const todayCompletion = await db.completions
      .where("[habitId+date]")
      .equals([habitId, todayStr])
      .first();
    if (todayCompletion) {
      return "already-completed";
    }

    // Has any freeze been used in this calendar week already?
    const weekCompletions = await db.completions
      .where("habitId")
      .equals(habitId)
      .filter(
        (c) =>
          c.source === "freeze" && c.date >= startStr && c.date <= endStr,
      )
      .toArray();
    if (weekCompletions.length > 0) {
      return "already-frozen-this-week";
    }

    await db.completions.put({
      id: crypto.randomUUID(),
      habitId,
      date: todayStr,
      completedAt: Date.now(),
      source: "freeze",
    });
    await refreshStreak(habitId);
    return "applied";
  },

  async removeFreezeDay(habitId) {
    const db = getDb();
    const todayStr = toLocalDateString();
    const existing = await db.completions
      .where("[habitId+date]")
      .equals([habitId, todayStr])
      .first();
    // Only remove if it's actually a freeze — don't accidentally un-do a
    // manual tick from this code path.
    if (existing && existing.source === "freeze") {
      await db.completions.delete(existing.id);
      await refreshStreak(habitId);
    }
  },
}));
