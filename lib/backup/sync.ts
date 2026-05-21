"use client";

import { getSupabase } from "@/lib/supabase/client";
import { useSettingsStore } from "@/lib/stores/settings";
import {
  type BackupBlob,
  BACKUP_VERSION,
  serializeBackup,
} from "./serialize";

// Orchestrators for upload / fetch / auto-backup. All four require the user
// to be signed in — caller is responsible for gating on auth state.

const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

export type UploadResult =
  | { ok: true; updatedAt: number }
  | { ok: false; reason: "not_signed_in" | "network"; detail?: string };

export type FetchResult =
  | { ok: true; blob: BackupBlob | null; updatedAt: number | null }
  | { ok: false; reason: "not_signed_in" | "network"; detail?: string };

let uploadInFlight: Promise<UploadResult> | null = null;

export function uploadBackup(): Promise<UploadResult> {
  if (uploadInFlight) return uploadInFlight;
  uploadInFlight = (async () => {
    try {
      return await runUpload();
    } finally {
      uploadInFlight = null;
    }
  })();
  return uploadInFlight;
}

async function runUpload(): Promise<UploadResult> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, reason: "not_signed_in" };
  }
  const blob = await serializeBackup();
  const updatedAtIso = new Date(blob.exportedAt).toISOString();
  const { error } = await supabase.from("backups").upsert({
    user_id: userData.user.id,
    data: blob,
    updated_at: updatedAtIso,
  });
  if (error) {
    return { ok: false, reason: "network", detail: error.message };
  }
  // Persist the local marker so AppHydrator's daily auto-backup check has a
  // truthful "when did this device last push" value.
  await useSettingsStore.getState().update({ lastBackupAt: blob.exportedAt });
  return { ok: true, updatedAt: blob.exportedAt };
}

export async function fetchBackup(): Promise<FetchResult> {
  const supabase = getSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, reason: "not_signed_in" };
  }
  const { data, error } = await supabase
    .from("backups")
    .select("data, updated_at")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: "network", detail: error.message };
  }
  if (!data) {
    return { ok: true, blob: null, updatedAt: null };
  }
  // Light shape guard — Supabase types `data` as our BackupBlob via the
  // generated Database type, but at runtime the row could be from an older
  // app version that wrote a different shape. Restore re-checks the version
  // explicitly; here we only confirm the top-level structure exists.
  const blob = data.data as unknown as BackupBlob;
  if (!blob || typeof blob !== "object" || !("version" in blob)) {
    return { ok: false, reason: "network", detail: "Malformed cloud blob" };
  }
  return {
    ok: true,
    blob,
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

// Auto-backup check, called from AppHydrator. Quietly no-ops when the user
// isn't signed in or the local marker is fresh enough.
export async function maybeAutoBackup(): Promise<void> {
  const lastBackupAt = useSettingsStore.getState().settings.lastBackupAt;
  if (
    lastBackupAt !== undefined &&
    Date.now() - lastBackupAt < AUTO_BACKUP_INTERVAL_MS
  ) {
    return;
  }
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return; // not signed in — nothing to do
  // Fire-and-forget; uploadBackup handles its own concurrency + error logging.
  void uploadBackup();
}

// Re-exported so callers don't need a separate import path.
export { BACKUP_VERSION };
