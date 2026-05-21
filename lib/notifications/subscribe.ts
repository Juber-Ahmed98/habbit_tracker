"use client";

import { getSupabase } from "@/lib/supabase/client";
import { urlBase64ToArrayBuffer } from "./vapid";

// Client-side push lifecycle. Three concerns:
//
//   * detectPushSupport()  — synchronous capability gate. The Settings card
//     uses this to render the "unsupported browser" view without flashing.
//   * getPushState()       — async snapshot of (permission, subscribed).
//     Called by the Settings card on mount and after any toggle.
//   * enablePush() / disablePush() — the two state transitions, each fully
//     idempotent. enablePush also writes the row to Supabase; disablePush
//     deletes it. Errors are returned as discriminated unions rather than
//     thrown, mirroring the convention in lib/backup/sync.ts.

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: "no-sw" | "no-push" | "no-notifications" };

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "no-sw" };
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "no-sw" };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: "no-push" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "no-notifications" };
  }
  return { supported: true };
}

export type PushState = {
  permission: NotificationPermission;
  subscribed: boolean;
};

export async function getPushState(): Promise<PushState> {
  const support = detectPushSupport();
  if (!support.supported) {
    return { permission: "denied", subscribed: false };
  }
  const permission = Notification.permission;
  // ready resolves to the active registration; serwist registers the SW on
  // first page load so this resolves immediately once the install has run.
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return { permission, subscribed: subscription !== null };
}

export type EnableResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unsupported"
        | "permission-denied"
        | "not-signed-in"
        | "vapid-missing"
        | "network";
      detail?: string;
    };

export async function enablePush(): Promise<EnableResult> {
  const support = detectPushSupport();
  if (!support.supported) return { ok: false, reason: "unsupported" };

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "vapid-missing" };

  // 1. Auth — the row we're about to write is keyed by auth.uid().
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, reason: "not-signed-in" };
  }

  // 2. Permission — request only if still "default". Calling requestPermission
  // when the user has already denied will silently re-return "denied"; we
  // surface that as a distinct UI state.
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  // 3. Subscribe via the registered SW. If a subscription already exists we
  // reuse it — re-subscribing with the same applicationServerKey returns the
  // existing one, but explicit reuse keeps the upsert below trivially safe.
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(vapid),
    }));
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) {
    return {
      ok: false,
      reason: "network",
      detail: "Browser returned an incomplete subscription.",
    };
  }

  // 4. Persist. Conflict target is (user_id, endpoint) — same browser, same
  // endpoint, just refreshes the timezone + user_agent.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      timezone,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) {
    // Subscription was created in the browser but we couldn't persist it.
    // Roll back so a retry starts from a clean state.
    await subscription.unsubscribe().catch(() => {});
    return { ok: false, reason: "network", detail: error.message };
  }

  return { ok: true };
}

export type DisableResult =
  | { ok: true }
  | { ok: false; reason: "not-signed-in" | "network"; detail?: string };

export async function disablePush(): Promise<DisableResult> {
  const support = detectPushSupport();
  if (!support.supported) return { ok: true }; // nothing to disable

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  // Always tear down the browser-side first; if it succeeds the device stops
  // receiving messages even when the server cleanup below fails.
  let endpoint: string | null = null;
  if (subscription) {
    endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
  }

  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, reason: "not-signed-in" };
  }

  if (endpoint) {
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("endpoint", endpoint);
    if (error) {
      return { ok: false, reason: "network", detail: error.message };
    }
  }
  return { ok: true };
}

// Fires a single test notification to the signed-in user's subscriptions via
// the server route. Lives here so the NotificationsCard doesn't fetch raw.
export async function sendTestPush(): Promise<
  { ok: true } | { ok: false; detail: string }
> {
  try {
    const res = await fetch("/api/notifications/test", { method: "POST" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, detail: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "network error",
    };
  }
}
