"use client";

import { type User } from "@supabase/supabase-js";
import { create } from "zustand";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Lightweight store mirroring Supabase auth state so the BackupCard can read
// `user` synchronously during render without each consumer subscribing to
// onAuthStateChange separately. AppHydrator calls `subscribeBackupAuth` once
// on mount; from then on the store reflects sign-in / sign-out / refresh.

type BackupStore = {
  user: User | null;
  // Whether the initial getSession() has resolved. Distinguishes
  // "definitely-not-signed-in" from "we haven't checked yet" so the UI can
  // skip rendering a stale "sign in" CTA during the first paint.
  authChecked: boolean;

  // Set by the auth-state subscription. Not for direct UI use.
  _setUser: (user: User | null, authChecked: boolean) => void;
};

export const useBackupStore = create<BackupStore>((set) => ({
  user: null,
  authChecked: false,
  _setUser: (user, authChecked) => set({ user, authChecked }),
}));

let subscriptionStarted = false;

// Initialise the auth-state mirror. Idempotent — safe to call from
// AppHydrator's effect on every mount; subsequent calls no-op.
export function subscribeBackupAuth(): void {
  if (subscriptionStarted) return;
  if (!isSupabaseConfigured()) {
    // No env configured — leave `authChecked: false`. UI gates on
    // isSupabaseConfigured() anyway, so the card simply doesn't render.
    return;
  }
  subscriptionStarted = true;
  const supabase = getSupabase();
  void (async () => {
    const { data } = await supabase.auth.getSession();
    useBackupStore.getState()._setUser(data.session?.user ?? null, true);
  })();
  supabase.auth.onAuthStateChange((_event, session) => {
    useBackupStore.getState()._setUser(session?.user ?? null, true);
  });
}
