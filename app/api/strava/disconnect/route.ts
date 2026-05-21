import { NextResponse } from "next/server";
import {
  cookieAttributes,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/strava/server";

// Clears the signed session cookie. We don't bother calling Strava's
// /oauth/deauthorize — re-authorisation is silent if the user previously
// approved, and revoking server-side is the user's choice in Strava settings.

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; ${cookieAttributes({ maxAgeSec: 0 })}`,
  );
  res.headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; ${cookieAttributes({ maxAgeSec: 0 })}`,
  );
  return res;
}
