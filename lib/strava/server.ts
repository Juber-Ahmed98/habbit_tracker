// Server-only Strava helpers. Never import from a client component — uses
// Node `crypto` and reads env vars that don't exist in the browser bundle.
// Calls to this module are made from route handlers under app/api/strava.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { type StravaTokenResponse } from "./types";

// -- Constants --------------------------------------------------------------

export const SESSION_COOKIE = "strava_session";
export const STATE_COOKIE = "strava_oauth_state";

// 60 seconds early-refresh window — refresh access tokens slightly before
// Strava's stated expiry so a request in flight doesn't race the boundary.
const EARLY_REFRESH_MS = 60_000;

const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";

// -- Env --------------------------------------------------------------------

type Env = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cookieSecret: string;
};

function readEnv(): Env {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const cookieSecret = process.env.STRAVA_COOKIE_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !cookieSecret) {
    throw new Error(
      "Strava env vars missing — set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI, STRAVA_COOKIE_SECRET",
    );
  }
  return { clientId, clientSecret, redirectUri, cookieSecret };
}

// -- Session shape ----------------------------------------------------------

export type Session = {
  athleteId: number;
  accessToken: string;
  refreshToken: string;
  // Epoch ms when accessToken expires. Refresh proactively before this.
  accessTokenExpiresAt: number;
};

// -- Cookie sign / verify ---------------------------------------------------

// `<base64url(json)>.<base64url(hmacSig)>` — compact, no JWT dependency.
export function signSession(session: Session): string {
  const env = readEnv();
  const json = JSON.stringify(session);
  const data = Buffer.from(json, "utf8").toString("base64url");
  const sig = createHmac("sha256", env.cookieSecret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(cookie: string | undefined | null): Session | null {
  if (!cookie || typeof cookie !== "string") return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const data = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const env = readEnv();
  const expected = createHmac("sha256", env.cookieSecret).update(data).digest();
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const json = Buffer.from(data, "base64url").toString("utf8");
    const obj = JSON.parse(json) as Partial<Session>;
    if (
      typeof obj.athleteId === "number" &&
      typeof obj.accessToken === "string" &&
      typeof obj.refreshToken === "string" &&
      typeof obj.accessTokenExpiresAt === "number"
    ) {
      return obj as Session;
    }
    return null;
  } catch {
    return null;
  }
}

// Standard cookie attributes used for both session and state cookies. Secure
// is gated on the redirect URI scheme so http://localhost dev still works.
export function cookieAttributes(opts: { maxAgeSec: number }): string {
  const env = readEnv();
  const secure = env.redirectUri.startsWith("https://");
  const parts = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${opts.maxAgeSec}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

// -- OAuth flow -------------------------------------------------------------

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(state: string): string {
  const env = readEnv();
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.searchParams.set("client_id", env.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", env.redirectUri);
  u.searchParams.set("scope", "read,activity:read_all");
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("state", state);
  return u.toString();
}

// Exchange the one-shot `code` from Strava's callback for tokens.
export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const env = readEnv();
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    code,
    grant_type: "authorization_code",
  });
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava code exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

// Swap a refresh token for a fresh access token. Strava may also rotate the
// refresh token on this call — always persist whatever it returns.
export async function refreshAccessToken(
  refreshToken: string,
): Promise<StravaTokenResponse> {
  const env = readEnv();
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Strava refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as StravaTokenResponse;
}

// Compose a Session from a Strava token response. Used by both the callback
// (post code-exchange) and the refresh path.
export function sessionFromTokenResponse(
  tokens: StravaTokenResponse,
  fallbackAthleteId?: number,
): Session {
  const athleteId = tokens.athlete?.id ?? fallbackAthleteId;
  if (athleteId === undefined) {
    throw new Error("Strava token response missing athlete id");
  }
  return {
    athleteId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: tokens.expires_at * 1000,
  };
}

// Returns a session whose access token is guaranteed fresh for the next
// minute. If the current token is close to (or past) expiry, refresh and
// hand back a new session — the caller is responsible for writing it back
// to the cookie on the response.
export async function ensureFreshSession(session: Session): Promise<Session> {
  if (session.accessTokenExpiresAt - EARLY_REFRESH_MS > Date.now()) {
    return session;
  }
  const tokens = await refreshAccessToken(session.refreshToken);
  return sessionFromTokenResponse(tokens, session.athleteId);
}
