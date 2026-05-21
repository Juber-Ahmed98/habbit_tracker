// Hand-written Database type. Mirrors:
//   * supabase/migrations/0001_backups.sql  (Step 11a — `backups`)
//   * supabase/migrations/0002_push.sql     (Step 11b — push + schedules)
// When the schema gains tables this file needs to match. The Dexie-dump shape
// that goes into `backups.data` is described by BackupBlob in
// lib/backup/serialize.ts so the JSON here stays opaque to PostgREST's typing.

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
      push_subscriptions: {
        Row: {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          timezone: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          timezone: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          timezone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reminder_schedules: {
        Row: {
          user_id: string;
          habit_id: string;
          title: string;
          tab: string;
          days: number[];
          time_local: string;
          timezone: string;
          last_fired_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          habit_id: string;
          title: string;
          tab: string;
          days: number[];
          time_local: string;
          timezone: string;
          last_fired_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          habit_id?: string;
          title?: string;
          tab?: string;
          days?: number[];
          time_local?: string;
          timezone?: string;
          last_fired_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
