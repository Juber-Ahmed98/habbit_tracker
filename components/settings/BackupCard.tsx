"use client";

import { formatDistanceToNowStrict } from "date-fns";
import {
  CloudUpload,
  DownloadCloud,
  LogOut,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { restoreBackup } from "@/lib/backup/restore";
import { fetchBackup, uploadBackup } from "@/lib/backup/sync";
import { disablePush } from "@/lib/notifications/subscribe";
import { useBackupStore } from "@/lib/stores/backup";
import { useSettingsStore } from "@/lib/stores/settings";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// §11 Cloud sync — option-2 minimal backup card. Sign in via magic link,
// upload a snapshot, restore destructively from cloud, sign out. Anything
// fancier (per-table sync, conflict resolution) belongs to a later phase.

type Banner =
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string }
  | null;

type BusyKind = "upload" | "restore" | null;

export function BackupCard() {
  // Always render *something* so a misconfigured install never silently
  // hides the card. Env vars are inlined into the client bundle at build
  // time — if they're empty here the dev server (or Vercel build) didn't
  // pick them up.
  if (!isSupabaseConfigured()) return <NotConfiguredCard />;
  return <BackupCardInner />;
}

function NotConfiguredCard() {
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
        Cloud backup
      </p>
      <p className="text-[12px]" style={{ color: "var(--danger)" }}>
        Supabase env vars not loaded in this build.
      </p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
        <code>.env.local</code>, then fully restart the dev server (
        <code>NEXT_PUBLIC_*</code> values are baked in at start).
      </p>
    </section>
  );
}

function BackupCardInner() {
  const params = useSearchParams();
  const user = useBackupStore((s) => s.user);
  const authChecked = useBackupStore((s) => s.authChecked);
  const lastBackupAt = useSettingsStore((s) => s.settings.lastBackupAt);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [override, setOverride] = useState<Banner>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  // Initial banner driven by ?backup=... from the magic-link callback. Once
  // any local action runs we switch to the override banner.
  const initialBanner: Banner = useMemo(() => {
    const flag = params.get("backup");
    const reason = params.get("reason");
    if (flag === "signed_in") {
      return { kind: "ok", text: "Signed in — cloud backup is on." };
    }
    if (flag === "error") {
      return {
        kind: "error",
        text: `Couldn't complete sign-in: ${reason ?? "unknown error"}.`,
      };
    }
    return null;
  }, [params]);
  const banner = override ?? initialBanner;

  // Strip the ?backup= flag from the URL once we've consumed it so a
  // back/forward navigation doesn't re-show the banner.
  useEffect(() => {
    if (!params.get("backup")) return;
    window.history.replaceState(null, "", "/settings");
  }, [params]);

  async function sendMagicLink() {
    if (sending || !email.trim()) return;
    setSending(true);
    setOverride(null);
    try {
      const supabase = getSupabase();
      const next = "/settings";
      const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setOverride({ kind: "error", text: `Couldn't send link: ${error.message}` });
      } else {
        setOverride({
          kind: "ok",
          text: "Check your email for a sign-in link.",
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    // Tear down push *before* signing out — disablePush needs the session
    // cookie to delete its push_subscriptions row (RLS). Failing here is
    // non-fatal; we still proceed to sign-out so the user isn't stranded.
    await disablePush().catch(() => undefined);
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setOverride({ kind: "ok", text: "Signed out." });
  }

  async function handleUpload() {
    if (busy) return;
    setBusy("upload");
    setOverride(null);
    try {
      const result = await uploadBackup();
      if (result.ok) {
        setOverride({ kind: "ok", text: "Backup uploaded." });
      } else if (result.reason === "not_signed_in") {
        setOverride({ kind: "error", text: "Sign in first." });
      } else {
        setOverride({
          kind: "error",
          text: `Backup failed: ${result.detail ?? "network error"}.`,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy("restore");
    setOverride(null);
    try {
      const result = await fetchBackup();
      if (!result.ok) {
        setOverride({
          kind: "error",
          text:
            result.reason === "not_signed_in"
              ? "Sign in first."
              : `Couldn't fetch backup: ${result.detail ?? "network error"}.`,
        });
        return;
      }
      if (!result.blob) {
        setOverride({
          kind: "error",
          text: "No backup found in the cloud yet.",
        });
        return;
      }
      await restoreBackup(result.blob);
      // Restore touched every table; reload so Zustand stores re-hydrate from
      // the fresh Dexie state. Settings carries lastBackupAt forward.
      window.location.reload();
    } catch (err) {
      setOverride({
        kind: "error",
        text:
          err instanceof Error
            ? `Restore failed: ${err.message}`
            : "Restore failed.",
      });
    } finally {
      setBusy(null);
      setConfirmingRestore(false);
    }
  }

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
        Cloud backup
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

      {!authChecked ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Checking sign-in…
        </p>
      ) : user ? (
        <SignedInView
          email={user.email ?? ""}
          lastBackupAt={lastBackupAt}
          busy={busy}
          confirmingRestore={confirmingRestore}
          onUpload={() => void handleUpload()}
          onRestoreRequest={() => setConfirmingRestore(true)}
          onRestoreCancel={() => setConfirmingRestore(false)}
          onRestoreConfirm={() => void handleRestore()}
          onSignOut={() => void signOut()}
        />
      ) : (
        <SignInForm
          email={email}
          onEmail={setEmail}
          sending={sending}
          onSubmit={() => void sendMagicLink()}
        />
      )}
    </section>
  );
}

function SignInForm({
  email,
  onEmail,
  sending,
  onSubmit,
}: {
  email: string;
  onEmail: (s: string) => void;
  sending: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Sign in with a magic link to back up your habits, completions, and
        fitness data to the cloud. Backup is one-way — restore is destructive
        and replaces local data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex gap-2"
      >
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
        >
          <Mail size={14} aria-hidden />
          {sending ? "Sending…" : "Send link"}
        </button>
      </form>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Tap the link from the same device where the app is installed so the
        session lands here.
      </p>
    </>
  );
}

function SignedInView({
  email,
  lastBackupAt,
  busy,
  confirmingRestore,
  onUpload,
  onRestoreRequest,
  onRestoreCancel,
  onRestoreConfirm,
  onSignOut,
}: {
  email: string;
  lastBackupAt: number | undefined;
  busy: BusyKind;
  confirmingRestore: boolean;
  onUpload: () => void;
  onRestoreRequest: () => void;
  onRestoreCancel: () => void;
  onRestoreConfirm: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2"
        style={{ backgroundColor: "var(--surface-alt)" }}
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--success)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{email}</p>
          <p
            className="truncate text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {lastBackupAt
              ? `Last backed up ${formatDistanceToNowStrict(lastBackupAt, { addSuffix: true })}`
              : "Not backed up yet."}
          </p>
        </div>
      </div>

      {confirmingRestore ? (
        <div
          className="space-y-2 rounded-xl px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            border: "1px solid var(--danger)",
            color: "var(--text)",
          }}
        >
          <p>
            Restoring will replace all local data with the cloud copy. Any
            ticks or imports on this device since the last backup will be
            lost. Continue?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRestoreCancel}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRestoreConfirm}
              disabled={busy !== null}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60"
              style={{
                backgroundColor: "var(--danger)",
                color: "var(--bg)",
              }}
            >
              {busy === "restore" ? "Restoring…" : "Replace local data"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onUpload}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {busy === "upload" ? (
              <RefreshCw size={14} aria-hidden className="animate-spin" />
            ) : (
              <CloudUpload size={14} aria-hidden />
            )}
            {busy === "upload" ? "Uploading…" : "Backup now"}
          </button>
          <button
            type="button"
            onClick={onRestoreRequest}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            <DownloadCloud size={14} aria-hidden /> Restore
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--surface-alt)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </div>
      )}
    </>
  );
}
