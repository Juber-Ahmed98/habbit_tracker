import { NextResponse } from "next/server";
import { type PushPayload } from "@/lib/notifications/payload";
import { sendPush } from "@/lib/notifications/webpush-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

// Triggered by the "Send test" button in Settings → Notifications. Sends one
// push to every subscription the signed-in user owns. Auth is the user's
// Supabase session cookie (set by app/api/auth/callback); rows are looked up
// via the admin client to keep the query path uniform with the cron route.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const userClient = await getSupabaseServer();
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  const userId = userData.user.id;

  const admin = getSupabaseAdmin();
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (subsError) {
    return NextResponse.json(
      { error: "subs_query_failed", detail: subsError.message },
      { status: 500 },
    );
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json(
      { error: "no_subscriptions" },
      { status: 404 },
    );
  }

  const payload: PushPayload = {
    title: "Test notification",
    body: "If you see this, push is wired up correctly.",
    deepLink: "/settings",
    habitId: "__test__",
  };

  let sent = 0;
  let gone = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, payload);
    if (result.ok) sent += 1;
    else if (result.gone) gone += 1;
  }
  return NextResponse.json({ ok: true, sent, gone });
}
