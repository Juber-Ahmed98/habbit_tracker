"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Link as LinkIcon, RefreshCw, Unlink } from "lucide-react";
import { syncStravaActivities } from "@/lib/strava/sync";
import { useSettingsStore } from "@/lib/stores/settings";

// §11 Fitness sources — Strava sub-card. Disconnect/Connect/Refresh, plus a
// banner that reads ?strava=connected|error after the OAuth callback redirect
// and persists the connection state into Dexie via the settings store.

type SyncState = "idle" | "running" | "ok" | "error";
type Banner = { kind: "ok" | "error"; text: string } | null;

export function StravaSourceCard() {
  const params = useSearchParams();
  const strava = useSettingsStore((s) => s.settings.strava);
  const updateSettings = useSettingsStore((s) => s.update);

  // The URL flag drives the *initial* banner state during render; once the
  // async confirm or disconnect handler runs we override via `override`.
  const flag = params.get("strava");
  const reason = params.get("reason");
  const initialBanner: Banner = useMemo(() => {
    if (flag === "error") {
      return {
        kind: "error",
        text: `Strava connection failed: ${reason ?? "unknown"}.`,
      };
    }
    if (flag === "connected") {
      return { kind: "ok", text: "Strava connected — confirming…" };
    }
    return null;
  }, [flag, reason]);

  const [override, setOverride] = useState<Banner>(null);
  const banner = override ?? initialBanner;

  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncDetail, setSyncDetail] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    setSyncState("running");
    setSyncDetail(null);
    const result = await syncStravaActivities();
    if (result.ok) {
      setSyncState("ok");
      setSyncDetail(
        result.inserted > 0
          ? `${result.inserted} new activit${result.inserted === 1 ? "y" : "ies"}.`
          : "Already up to date.",
      );
    } else {
      setSyncState("error");
      setSyncDetail(
        result.reason === "not_connected"
          ? "Disconnected — reconnect Strava."
          : result.detail ?? "Sync failed.",
      );
    }
  }, []);

  // Side-effect for the post-redirect handshake. Banner state itself comes
  // from the URL via useMemo above so we don't synchronously setState here;
  // we only setOverride from async continuations once whoami resolves.
  useEffect(() => {
    if (!flag) return;
    if (flag === "error") {
      window.history.replaceState(null, "", "/settings");
      return;
    }
    if (flag !== "connected") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/strava/whoami", {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`whoami ${res.status}`);
        const data = (await res.json()) as {
          connected: boolean;
          athleteId?: number;
        };
        if (cancelled) return;
        if (data.connected && data.athleteId !== undefined) {
          await updateSettings({
            strava: { connected: true, athleteId: String(data.athleteId) },
          });
          setOverride({
            kind: "ok",
            text: "Strava connected — syncing now.",
          });
          void runSync();
        }
      } catch (err) {
        if (cancelled) return;
        setOverride({
          kind: "error",
          text:
            err instanceof Error
              ? `Couldn't confirm Strava connection: ${err.message}`
              : "Couldn't confirm Strava connection.",
        });
      }
      window.history.replaceState(null, "", "/settings");
    })();
    return () => {
      cancelled = true;
    };
  }, [flag, updateSettings, runSync]);

  async function disconnect() {
    const res = await fetch("/api/strava/disconnect", {
      method: "POST",
      credentials: "same-origin",
    });
    if (res.ok) {
      await updateSettings({ strava: { connected: false } });
      setOverride({ kind: "ok", text: "Strava disconnected." });
      setSyncState("idle");
      setSyncDetail(null);
    } else {
      setOverride({
        kind: "error",
        text: "Couldn't disconnect — try again.",
      });
    }
  }

  const connected = strava?.connected === true;
  const lastSyncAt = strava?.lastSyncAt;

  return (
    <section
      className="space-y-2 rounded-card px-3 py-3"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        Fitness sources · Strava
      </p>

      {banner ? (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            color:
              banner.kind === "error" ? "var(--danger)" : "var(--success)",
            border: `1px solid ${
              banner.kind === "error" ? "var(--danger)" : "var(--success)"
            }`,
          }}
        >
          {banner.text}
        </div>
      ) : null}

      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor: connected ? "var(--success)" : "var(--danger)",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {connected ? "Connected" : "Not connected"}
          </p>
          <p
            className="truncate text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {connected
              ? lastSyncAt
                ? `Synced ${formatDistanceToNowStrict(lastSyncAt, { addSuffix: true })}`
                : "Awaiting first sync."
              : "Pull workouts from your Garmin via Strava."}
          </p>
        </div>
      </div>

      {connected ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncState === "running"}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-ink)",
            }}
          >
            <RefreshCw
              size={14}
              aria-hidden
              className={syncState === "running" ? "animate-spin" : ""}
            />
            {syncState === "running" ? "Syncing…" : "Refresh now"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            <Unlink size={14} aria-hidden /> Disconnect
          </button>
        </div>
      ) : (
        <a
          href="/api/strava/authorize"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
        >
          <LinkIcon size={14} aria-hidden /> Connect Strava
        </a>
      )}

      {syncDetail ? (
        <p
          className="text-[11px]"
          style={{
            color:
              syncState === "error" ? "var(--danger)" : "var(--text-muted)",
          }}
        >
          {syncDetail}
        </p>
      ) : null}
    </section>
  );
}
