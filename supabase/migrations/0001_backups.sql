-- Step 11a — minimal cloud backup table.
--
-- One row per user; the entire Dexie dump lives in `data` as JSON. RLS pins
-- access to the authenticated user so a leaked publishable (anon) key can't
-- read or write anyone else's row.
--
-- Apply via Supabase SQL Editor on initial project setup. Idempotent guards
-- aren't included intentionally — failing loudly on a re-run is the right
-- signal that the project already has the schema.

create table backups (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data       jsonb not null
);

alter table backups enable row level security;

create policy "users manage their own backup"
  on backups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
