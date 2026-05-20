"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { toLocalDateString } from "@/lib/utils/date";

// Bed/wake-time inputs that write straight to the sleepLogs table on every
// change. Keyed by today's local date — this row represents "the night
// leading into today" (bedTime) plus today's wake (wakeTime).
export function SleepLogField() {
  const today = useMemo(() => toLocalDateString(), []);
  const log = useLiveQuery(() => getDb().sleepLogs.get(today), [today]);

  const save = async (patch: { bedTime?: string; wakeTime?: string }) => {
    const existing = await getDb().sleepLogs.get(today);
    await getDb().sleepLogs.put({
      date: today,
      bedTime: existing?.bedTime,
      wakeTime: existing?.wakeTime,
      ...patch,
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      className="rounded-card p-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <h3 className="mb-2 text-sm font-semibold">Sleep log</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Bed time
          </span>
          <input
            type="time"
            value={log?.bedTime ?? ""}
            onChange={(e) => void save({ bedTime: e.target.value || undefined })}
            className="w-full rounded-lg px-2 py-1 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </label>
        <label className="block">
          <span
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Wake time
          </span>
          <input
            type="time"
            value={log?.wakeTime ?? ""}
            onChange={(e) => void save({ wakeTime: e.target.value || undefined })}
            className="w-full rounded-lg px-2 py-1 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </label>
      </div>
    </div>
  );
}
