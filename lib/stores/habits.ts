"use client";

import { create } from "zustand";
import { getDb } from "../db";
import { type Habit, type HabitTab, type HabitType } from "../db/schema";
import { computeStreak } from "../streaks/compute";
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

type HabitsStore = {
  // Transient UI state — the habit being edited via the long-press sheet.
  editingHabitId: string | null;
  setEditingHabitId: (id: string | null) => void;

  // Commands. All writes funnel through here so future Step 4 streak
  // recompute / Step 5 notification re-registration can hook in one place.
  createHabit: (input: CreateHabitInput) => Promise<string>;
  updateHabit: (id: string, patch: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  tickHabit: (habitId: string, date?: string) => Promise<void>;
  untickHabit: (habitId: string, date?: string) => Promise<void>;
  toggleHabit: (habitId: string, date?: string) => Promise<boolean>;
};

async function refreshStreak(habitId: string) {
  const db = getDb();
  const completions = await db.completions
    .where("habitId")
    .equals(habitId)
    .toArray();
  const snapshot = computeStreak(habitId, completions);
  await db.streakSnapshots.put(snapshot);
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

  async tickHabit(habitId, date) {
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
      source: "manual",
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
      return false;
    }
    await db.completions.put({
      id: crypto.randomUUID(),
      habitId,
      date: dateStr,
      completedAt: Date.now(),
      source: "manual",
    });
    await refreshStreak(habitId);
    return true;
  },
}));
