import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type Database } from "./database.types";

// Server-side Supabase client for Route Handlers (the magic-link callback
// route). createServerClient wires `getAll` / `setAll` to Next's cookies()
// API so auth.exchangeCodeForSession can write the session cookie that the
// browser client will subsequently pick up on the next render.

export async function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // Route handlers can mutate cookies; wrap in try/catch so that
        // accidental calls from server components (which can't mutate) fail
        // silently rather than crash the response.
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // ignore — caller was a server component
        }
      },
    },
  });
}
