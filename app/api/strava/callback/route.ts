import { NextResponse, type NextRequest } from "next/server";
import {
  cookieAttributes,
  exchangeCode,
  sessionFromTokenResponse,
  signSession,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/strava/server";

// Strava redirects here with ?code, ?state, and (on failure) ?error. We
// verify the state nonce against the cookie we set in /authorize, swap the
// code for tokens, then 302 to /settings?strava=connected (or ?strava=error).

export const runtime = "nodejs";

function redirectToSettings(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const origin = new URL(request.url).origin;
  const url = new URL("/settings", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  // Clear the state cookie either way — it's one-shot.
  const clearStateCookie = `${STATE_COOKIE}=; ${cookieAttributes({ maxAgeSec: 0 })}`;

  if (error) {
    const res = redirectToSettings(request, { strava: "error", reason: error });
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    const res = redirectToSettings(request, { strava: "error", reason: "state" });
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  }

  try {
    const tokens = await exchangeCode(code);
    const session = sessionFromTokenResponse(tokens);
    const sessionCookie = signSession(session);
    const res = redirectToSettings(request, { strava: "connected" });
    res.headers.append("Set-Cookie", clearStateCookie);
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sessionCookie}; ${cookieAttributes({ maxAgeSec: 60 * 60 * 24 * 365 })}`,
    );
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const res = redirectToSettings(request, {
      strava: "error",
      reason: "exchange",
      detail: message,
    });
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  }
}
