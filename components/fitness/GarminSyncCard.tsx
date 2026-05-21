"use client";

import { ChevronRight, Plug } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { useSettingsStore } from "@/lib/stores/settings";

// §5.2 — sync status card. Step 6 is permanently "disconnected" because the
// Strava OAuth wiring lands in Step 7; the colour-dot rules are written here
// now so the only change in Step 7 is providing real `lastSyncAt` values.
//
// Green: connected and synced in the last 24h.
// Amber: connected, last sync >24h ago.
// Red:   disconnected.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type Status = {
  dot: "green" | "amber" | "red";
  title: string;
  detail: string;
};

function computeStatus(
  connected: boolean,
  lastSyncAt: number | undefined,
): Status {
  if (!connected) {
    return {
      dot: "red",
      title: "Strava not connected",
      detail: "Connects in step 7 — opens Settings.",
    };
  }
  if (!lastSyncAt) {
    return { dot: "amber", title: "Strava connected", detail: "Awaiting first sync." };
  }
  const age = Date.now() - lastSyncAt;
  if (age < ONE_DAY_MS) {
    return {
      dot: "green",
      title: "Strava connected",
      detail: `Synced ${formatDistanceToNowStrict(lastSyncAt, { addSuffix: true })}`,
    };
  }
  return {
    dot: "amber",
    title: "Strava stale",
    detail: `Last sync ${formatDistanceToNowStrict(lastSyncAt, { addSuffix: true })}`,
  };
}

const DOT_COLOR: Record<Status["dot"], string> = {
  green: "var(--success)",
  amber: "var(--streak)",
  red: "var(--danger)",
};

export function GarminSyncCard() {
  const strava = useSettingsStore((s) => s.settings.strava);
  const status = computeStatus(strava?.connected ?? false, strava?.lastSyncAt);

  return (
    <Link
      href="/settings"
      className="flex items-center gap-3 rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }}
      >
        <Plug size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: DOT_COLOR[status.dot] }}
          />
          {status.title}
        </p>
        <p
          className="truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {status.detail}
        </p>
      </div>
      <ChevronRight
        size={16}
        aria-hidden
        style={{ color: "var(--text-muted)" }}
      />
    </Link>
  );
}
