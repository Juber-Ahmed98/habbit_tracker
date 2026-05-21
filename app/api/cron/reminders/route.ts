import { NextResponse } from "next/server";
import { type PushPayload } from "@/lib/notifications/payload";
import { sendPush } from "@/lib/notifications/webpush-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Hourly fan-out of per-habit reminders. Scheduled externally because Vercel
// Hobby caps cron at once-per-day; see .github/workflows/reminders.yml for
// the GitHub Actions timer that pings this route every hour.
//
// Auth: `Authorization: Bearer ${CRON_SECRET}`. The workflow injects it from
// a repo secret; same value lives in Vercel env so this route can verify.
// We reject 401 if the header doesn't match, so a hand-curled URL with no
// auth can't fan out.
//
// Resolution rule: for each `reminder_schedules` row, compute the row's
// timezone-local current weekday + hour from "now". Fire when:
//   * row.days includes the local weekday (0–6, Sun–Sat)
//   * row.time_local's hour equals the local hour
//   * row.last_fired_at is null or older than this UTC hour boundary
// Dedupe is keyed off the UTC hour boundary because cron always fires at
// :00 UTC; storing the floor avoids drift if a retry happens within the
// same hour.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localPartsInTz(
  now: Date,
  timeZone: string,
): { hour: number; weekday: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value;
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value;
    if (!hourPart || !weekdayPart) return null;
    // Intl returns "24" rather than "0" for midnight in some Node builds —
    // normalise so the equality check against time_local's hour holds.
    const hourNum = Number(hourPart) % 24;
    const weekday = WEEKDAY_MAP[weekdayPart];
    if (Number.isNaN(hourNum) || weekday === undefined) return null;
    return { hour: hourNum, weekday };
  } catch {
    // Bad IANA name — bail; caller will skip this row.
    return null;
  }
}

function parseTimeLocalHour(time: string): number | null {
  const m = /^(\d{2}):\d{2}$/.exec(time);
  if (!m) return null;
  const hour = Number(m[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_secret_missing" }, { status: 500 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Step 1 — read every schedule row. Volume is one-per-user-per-scheduled
  // habit; in this app's lifetime that's well within a single page.
  const { data: schedules, error: schedulesError } = await admin
    .from("reminder_schedules")
    .select(
      "user_id, habit_id, title, tab, days, time_local, timezone, last_fired_at",
    );
  if (schedulesError) {
    return NextResponse.json(
      { error: "schedules_query_failed", detail: schedulesError.message },
      { status: 500 },
    );
  }

  const now = new Date();
  const hourStartUtc = new Date(now);
  hourStartUtc.setUTCMinutes(0, 0, 0);

  type ScheduleRow = NonNullable<typeof schedules>[number];
  const fireable: ScheduleRow[] = [];

  for (const row of schedules ?? []) {
    const local = localPartsInTz(now, row.timezone);
    if (!local) continue;
    if (!row.days.includes(local.weekday)) continue;
    const targetHour = parseTimeLocalHour(row.time_local);
    if (targetHour === null) continue;
    if (targetHour !== local.hour) continue;
    if (row.last_fired_at && new Date(row.last_fired_at) >= hourStartUtc) {
      continue; // already fired this hour
    }
    fireable.push(row);
  }

  if (fireable.length === 0) {
    return NextResponse.json({ ok: true, fired: 0, sent: 0, gone: 0 });
  }

  // Step 2 — load the push subscriptions for every user who has at least one
  // fireable row. One query is cheaper than N.
  const userIds = Array.from(new Set(fireable.map((f) => f.user_id)));
  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (subsError) {
    return NextResponse.json(
      { error: "subs_query_failed", detail: subsError.message },
      { status: 500 },
    );
  }

  const subsByUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  // Step 3 — fan out. Sequential per habit to keep error reporting clear; the
  // expected volume is small.
  let sentCount = 0;
  let goneCount = 0;
  const fired: ScheduleRow[] = [];

  for (const f of fireable) {
    const list = subsByUser.get(f.user_id) ?? [];
    if (list.length === 0) continue;
    const payload: PushPayload = {
      title: f.title,
      body: `Reminder: ${f.title}`,
      deepLink: `/${f.tab}`,
      habitId: f.habit_id,
    };
    let anyOk = false;
    for (const sub of list) {
      const result = await sendPush(sub, payload);
      if (result.ok) {
        sentCount += 1;
        anyOk = true;
      } else if (result.gone) {
        goneCount += 1;
      }
    }
    if (anyOk) fired.push(f);
  }

  // Step 4 — stamp last_fired_at on the rows we fired. Single upsert; rows
  // are carried over from step 1 so the not-null columns are populated.
  if (fired.length > 0) {
    const nowIso = now.toISOString();
    await admin
      .from("reminder_schedules")
      .upsert(
        fired.map((r) => ({ ...r, last_fired_at: nowIso })),
        { onConflict: "user_id,habit_id" },
      );
  }

  return NextResponse.json({
    ok: true,
    fired: fireable.length,
    sent: sentCount,
    gone: goneCount,
  });
}
