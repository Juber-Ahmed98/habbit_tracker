"use client";

import { Bell, BellOff, RefreshCw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type PushState,
  type PushSupport,
  detectPushSupport,
  disablePush,
  enablePush,
  getPushState,
  sendTestPush,
} from "@/lib/notifications/subscribe";
import { useBackupStore } from "@/lib/stores/backup";
import { isSupabaseConfigured } from "@/lib/supabase/client";

// §8 / §13.11 — Web push reminders. Sits below BackupCard in Settings.
// Gated on (1) browser capability, (2) signed-in cloud-backup state — the
// cron route needs a Supabase user id to address the subscription.

type Banner = { kind: "ok" | "error"; text: string } | null;
type Busy = "enable" | "disable" | "test" | null;

export function NotificationsCard() {
  // Hard gates first — these render even on a misconfigured install.
  if (!isSupabaseConfigured()) return null;

  // detectPushSupport runs once per render — it's a pure capability sniff, no
  // permission prompt or network — so it's safe to call inline rather than
  // hoisting into state.
  const support = detectPushSupport();
  if (!support.supported) {
    return <UnsupportedCard support={support} />;
  }
  return <NotificationsCardInner />;
}

function UnsupportedCard({ support }: { support: PushSupport }) {
  return (
    <Shell>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Reminders need a browser with push and notifications support — Chrome
        on Android. (
        {support.supported ? "ok" : support.reason})
      </p>
    </Shell>
  );
}

function NotificationsCardInner() {
  const user = useBackupStore((s) => s.user);
  const authChecked = useBackupStore((s) => s.authChecked);

  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [banner, setBanner] = useState<Banner>(null);

  // Load current push state on mount and whenever the user changes (sign-out
  // doesn't itself unsubscribe the browser; we still want the card to reflect
  // the device's subscription state).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await getPushState();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function reloadState() {
    const next = await getPushState();
    setState(next);
  }

  async function handleEnable() {
    if (busy) return;
    setBusy("enable");
    setBanner(null);
    try {
      const result = await enablePush();
      if (result.ok) {
        setBanner({ kind: "ok", text: "Reminders enabled on this device." });
      } else {
        setBanner({ kind: "error", text: enableErrorText(result) });
      }
    } finally {
      setBusy(null);
      await reloadState();
    }
  }

  async function handleDisable() {
    if (busy) return;
    setBusy("disable");
    setBanner(null);
    try {
      const result = await disablePush();
      if (result.ok) {
        setBanner({ kind: "ok", text: "Reminders disabled on this device." });
      } else {
        setBanner({
          kind: "error",
          text:
            result.reason === "not-signed-in"
              ? "Sign in first."
              : `Couldn't disable: ${result.detail ?? "network error"}.`,
        });
      }
    } finally {
      setBusy(null);
      await reloadState();
    }
  }

  async function handleTest() {
    if (busy) return;
    setBusy("test");
    setBanner(null);
    try {
      const result = await sendTestPush();
      if (result.ok) {
        setBanner({ kind: "ok", text: "Test push sent." });
      } else {
        setBanner({ kind: "error", text: `Test failed: ${result.detail}.` });
      }
    } finally {
      setBusy(null);
    }
  }

  // Render branches ----------------------------------------------------------

  if (!authChecked || state === null) {
    return (
      <Shell>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Checking…
        </p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell banner={banner}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Sign in via cloud backup above to enable reminders. The server needs
          an account to fire scheduled pushes at the right time.
        </p>
      </Shell>
    );
  }

  if (state.permission === "denied") {
    return (
      <Shell banner={banner}>
        <p className="text-[12px]" style={{ color: "var(--danger)" }}>
          Notification permission is blocked for this site. Re-enable it in
          your browser site settings, then come back.
        </p>
      </Shell>
    );
  }

  if (!state.subscribed) {
    return (
      <Shell banner={banner}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Get a push when a habit&apos;s scheduled time rolls around. Reminders fire
          at hourly precision — a habit timed 09:15 fires when the 09:00 cron
          runs.
        </p>
        <button
          type="button"
          onClick={() => void handleEnable()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {busy === "enable" ? (
            <RefreshCw size={14} aria-hidden className="animate-spin" />
          ) : (
            <Bell size={14} aria-hidden />
          )}
          {busy === "enable" ? "Enabling…" : "Enable reminders"}
        </button>
      </Shell>
    );
  }

  // subscribed + granted
  return (
    <Shell banner={banner}>
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--success)" }}
        />
        <p className="text-[12px]" style={{ color: "var(--text)" }}>
          Reminders are on. Hourly cron fans out scheduled habits.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {busy === "test" ? (
            <RefreshCw size={14} aria-hidden className="animate-spin" />
          ) : (
            <Send size={14} aria-hidden />
          )}
          {busy === "test" ? "Sending…" : "Send test"}
        </button>
        <button
          type="button"
          onClick={() => void handleDisable()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <BellOff size={14} aria-hidden />
          {busy === "disable" ? "Disabling…" : "Disable"}
        </button>
      </div>
    </Shell>
  );
}

function enableErrorText(
  result: Exclude<Awaited<ReturnType<typeof enablePush>>, { ok: true }>,
): string {
  switch (result.reason) {
    case "unsupported":
      return "Push isn't supported on this browser.";
    case "vapid-missing":
      return "Push isn't configured for this build (NEXT_PUBLIC_VAPID_PUBLIC_KEY missing).";
    case "permission-denied":
      return "Notification permission was declined.";
    case "not-signed-in":
      return "Sign in first.";
    case "network":
      return `Couldn't save subscription: ${result.detail ?? "network error"}.`;
  }
}

// -- shell -------------------------------------------------------------------

function Shell({
  children,
  banner,
}: {
  children: React.ReactNode;
  banner?: Banner;
}) {
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
        Notifications
      </p>
      {banner ? (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: banner.kind === "error" ? "var(--danger)" : "var(--success)",
            border: `1px solid ${
              banner.kind === "error" ? "var(--danger)" : "var(--success)"
            }`,
          }}
        >
          {banner.text}
        </div>
      ) : null}
      {children}
    </section>
  );
}
