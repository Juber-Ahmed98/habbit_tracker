import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// Magic-link callback. Supabase emails the user a link of the form
//   https://<host>/api/auth/callback?code=<pkce-code>&next=<path>
// We exchange the code for a session (which writes httpOnly auth cookies via
// @supabase/ssr), then redirect to ?next (defaulting to /settings).

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/settings";

  if (!code) {
    return NextResponse.redirect(
      new URL(`/settings?backup=error&reason=missing_code`, url.origin),
    );
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings?backup=error&reason=${encodeURIComponent(error.message)}`,
        url.origin,
      ),
    );
  }

  // Successful sign-in. The session cookie has been written; redirect into
  // the app with a flag so BackupCard can show a "Signed in" banner.
  const dest = new URL(next.startsWith("/") ? next : "/settings", url.origin);
  dest.searchParams.set("backup", "signed_in");
  return NextResponse.redirect(dest);
}
