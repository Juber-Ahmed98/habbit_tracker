"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Bike,
  Dumbbell,
  Footprints,
  Heart,
  type LucideIcon,
  MoreHorizontal,
  PersonStanding,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { getDb } from "@/lib/db";
import { type FitnessSession, type FitnessSessionType } from "@/lib/db/schema";
import { useSettingsStore } from "@/lib/stores/settings";
import { formatDistance, formatDuration } from "@/lib/utils/format";
import { SessionDetailSheet } from "./SessionDetailSheet";

// §5.2 — "Recent activities list: last 7 days of synced sessions." Manual
// entries (Step 6) populate this; Strava (Step 7) / BLE (Step 8) / FIT (Step 9)
// will write through the same table via the fitness store.

const TYPE_ICON: Record<FitnessSessionType, LucideIcon> = {
  run: PersonStanding,
  ride: Bike,
  gym: Dumbbell,
  walk: Footprints,
  swim: Waves,
  other: MoreHorizontal,
};

const TYPE_LABEL: Record<FitnessSessionType, string> = {
  run: "Run",
  ride: "Ride",
  gym: "Gym",
  walk: "Walk",
  swim: "Swim",
  other: "Activity",
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function RecentActivitiesList() {
  const units = useSettingsStore((s) => s.settings.units);
  const [openId, setOpenId] = useState<string | null>(null);

  const sessions = useLiveQuery(() => {
    const since = Date.now() - SEVEN_DAYS_MS;
    return getDb()
      .fitnessSessions.where("startedAt")
      .above(since)
      .reverse()
      .sortBy("startedAt");
  }, []);

  return (
    <div
      className="rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="mb-2 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Recent activity · last 7 days
      </p>

      {sessions === undefined ? null : sessions.length === 0 ? (
        <p className="px-1 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
          No activities yet. Log one above, or wait for Strava sync (step 7).
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                className="flex w-full items-center gap-3 px-1 py-2 text-left"
              >
                <ActivityRow session={s} units={units} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <SessionDetailSheet
        sessionId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function ActivityRow({
  session,
  units,
}: {
  session: FitnessSession;
  units: "metric" | "imperial";
}) {
  const Icon = TYPE_ICON[session.type];
  const distance = formatDistance(session.distanceM, units);
  const duration = formatDuration(session.durationSec);
  return (
    <>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {session.name ?? TYPE_LABEL[session.type]}
        </p>
        <p
          className="truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {duration}
          {distance ? ` · ${distance}` : ""}
          {session.avgHr ? ` · ${session.avgHr} bpm` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {formatDistanceToNowStrict(new Date(session.startedAt), {
            addSuffix: true,
          })}
        </span>
        {session.avgHr ? (
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <Heart size={10} aria-hidden />
            {session.avgHr}
          </span>
        ) : null}
      </div>
    </>
  );
}
