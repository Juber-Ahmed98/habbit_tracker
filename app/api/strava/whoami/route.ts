import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/strava/server";

// Cheap connection check used by the client after the OAuth redirect lands
// on /settings?strava=connected. Reads the cookie, returns the athleteId if
// the signature is valid — does NOT contact Strava (saves a round-trip on
// every page load). Returns 401 when not connected.

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }
  return NextResponse.json({
    connected: true,
    athleteId: session.athleteId,
  });
}
