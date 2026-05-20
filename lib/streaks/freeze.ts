"use client";

import { addDays, startOfWeek } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "../db";
import { useSettingsStore } from "../stores/settings";
import { toLocalDateString } from "../utils/date";

export type FreezeStatus = {
  used: boolean;            // freeze applied somewhere in this calendar week
  usedDate?: string;        // which date it was applied to, if any
  todayIsFreeze: boolean;   // is the freeze applied to today specifically
  todayCompleted: boolean;  // any completion exists today (manual or freeze)
};

// Live freeze-day status for the current week. Caller renders a single
// section in the edit sheet from this; the toggle button in there hits
// applyFreezeDay / removeFreezeDay on the habits store.
export function useFreezeStatus(habitId: string | null): FreezeStatus | undefined {
  const startOn = useSettingsStore((s) => s.settings.startOfWeek);

  return useLiveQuery(async () => {
    if (!habitId) return undefined;
    const todayStr = toLocalDateString();
    const start = startOfWeek(new Date(), { weekStartsOn: startOn });
    const end = addDays(start, 6);
    const startStr = toLocalDateString(start);
    const endStr = toLocalDateString(end);

    const weekRows = await getDb()
      .completions.where("habitId")
      .equals(habitId)
      .filter((c) => c.date >= startStr && c.date <= endStr)
      .toArray();

    const freeze = weekRows.find((c) => c.source === "freeze");
    const todayRow = weekRows.find((c) => c.date === todayStr);

    return {
      used: !!freeze,
      usedDate: freeze?.date,
      todayIsFreeze: todayRow?.source === "freeze",
      todayCompleted: !!todayRow,
    } satisfies FreezeStatus;
  }, [habitId, startOn]);
}
