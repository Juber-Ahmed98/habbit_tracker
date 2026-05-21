// Hand-written Database type for the `backups` table (Step 11a). Mirrors
// supabase/migrations/0001_backups.sql — when the schema gains tables this
// file needs to match. The Dexie-dump shape that goes into `data` is
// described separately by BackupBlob in lib/backup/serialize.ts so the JSON
// here stays opaque to PostgREST's typing.

import { type BackupBlob } from "@/lib/backup/serialize";

export type Database = {
  public: {
    Tables: {
      backups: {
        Row: {
          user_id: string;
          updated_at: string;
          data: BackupBlob;
        };
        Insert: {
          user_id: string;
          updated_at?: string;
          data: BackupBlob;
        };
        Update: {
          user_id?: string;
          updated_at?: string;
          data?: BackupBlob;
        };
        // Supabase's generated types include Relationships; the GenericTable
        // constraint requires it even when empty, otherwise from("backups")
        // resolves to never and PostgREST builder types fall back to any.
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
