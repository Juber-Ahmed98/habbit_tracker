import { NextResponse } from "next/server";
import {
  buildAuthorizeUrl,
  cookieAttributes,
  generateState,
  STATE_COOKIE,
} from "@/lib/strava/server";

// Kicks off the OAuth dance: mint a CSRF nonce, stash it in a short-lived
// httpOnly cookie, then 302 to Strava's authorise URL. The callback route
// verifies the nonce matches before accepting the code.

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = generateState();
    const url = buildAuthorizeUrl(state);
    const res = NextResponse.redirect(url);
    res.headers.append(
      "Set-Cookie",
      `${STATE_COOKIE}=${state}; ${cookieAttributes({ maxAgeSec: 600 })}`,
    );
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
