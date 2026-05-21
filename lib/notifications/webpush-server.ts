// Server-only web-push helper. Lazy-initialises VAPID details on first use
// so a misconfigured env fails on first send rather than at module load
// (which would crash the cron route before the auth check runs).
//
// The cron route and the test route both go through `sendPush()` so the
// 404/410 cleanup logic only lives in one place.

import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { type PushPayload } from "./payload";

let initialised = false;

function ensureInit(): void {
  if (initialised) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "VAPID env missing — need VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialised = true;
}

export type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; gone: boolean; status: number | null; detail: string };

// Send one push. On 404/410 (subscription gone), delete the row so we don't
// keep retrying a dead endpoint. Any other failure is returned as-is for the
// caller to aggregate / log.
export async function sendPush(
  sub: SubscriptionRow,
  payload: PushPayload,
): Promise<SendResult> {
  ensureInit();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: unknown }).statusCode)
        : null;
    const detail = err instanceof Error ? err.message : String(err);
    const gone = status === 404 || status === 410;
    if (gone) {
      const admin = getSupabaseAdmin();
      await admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", sub.user_id)
        .eq("endpoint", sub.endpoint)
        .then(() => undefined);
    }
    return { ok: false, gone, status, detail };
  }
}
