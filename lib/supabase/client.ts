"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "./database.types";

// Singleton browser-side Supabase client. We use @supabase/ssr's
// createBrowserClient (rather than the bare supabase-js helper) so the auth
// state is read from cookies — the same source the server-side route handler
// in app/api/auth/callback writes to. That keeps session state consistent
// across client navigations and the eventual middleware refresh.

let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("getSupabase() called on the server — use server.ts");
  }
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  _client = createBrowserClient<Database>(url, key);
  return _client;
}

// True when the env vars are present at build time. UI uses this to
// gracefully hide the backup card on a dev install that hasn't been
// configured against a Supabase project.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
