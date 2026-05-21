import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "./database.types";

// Server-only Supabase client that holds the project secret key (legacy name:
// service_role). Bypasses RLS, so this MUST never be imported into a client
// component or a Route Handler reachable without auth — callers are
// responsible for gating (e.g. the cron route checks CRON_SECRET, the test
// route checks the user session before fanning out via this client).
//
// Singleton because createClient maintains internal HTTP keep-alive; one
// instance per server runtime is plenty.

let _admin: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Supabase admin env missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }
  _admin = createClient<Database>(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return _admin;
}
