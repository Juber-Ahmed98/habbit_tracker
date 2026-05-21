import { NextResponse, type NextRequest } from "next/server";
import {
  cookieAttributes,
  ensureFreshSession,
  SESSION_COOKIE,
  signSession,
  verifySession,
} from "@/lib/strava/server";

// Proxy to GET https://www.strava.com/api/v3/athlete/activities. Reads the
// signed session cookie, refreshes the access token if it's about to expire
// (writing the new session back as a Set-Cookie on the response), then
// forwards Strava's payload to the client. The client never sees the access
// token. Query params `after`, `before`, `page`, `per_page` pass through.

export const runtime = "nodejs";

const ALLOWED_PARAMS = new Set(["after", "before", "page", "per_page"]);

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySession(raw);
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  let fresh = session;
  try {
    fresh = await ensureFreshSession(session);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "refresh_failed";
    return NextResponse.json(
      { error: "refresh_failed", detail },
      { status: 401 },
    );
  }

  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  for (const [k, v] of new URL(request.url).searchParams) {
    if (ALLOWED_PARAMS.has(k)) url.searchParams.set(k, v);
  }
  // Default page size — Strava accepts up to 200; tune later if needed.
  if (!url.searchParams.has("per_page")) url.searchParams.set("per_page", "100");

  const stravaRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${fresh.accessToken}` },
    cache: "no-store",
  });

  const body = await stravaRes.text();
  const res = new NextResponse(body, {
    status: stravaRes.status,
    headers: {
      "Content-Type":
        stravaRes.headers.get("content-type") ?? "application/json",
    },
  });

  // If we just refreshed, persist the new tokens on the response.
  if (fresh !== session) {
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${signSession(fresh)}; ${cookieAttributes({ maxAgeSec: 60 * 60 * 24 * 365 })}`,
    );
  }

  return res;
}
