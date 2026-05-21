-- Step 11b — push notifications schema.
--
-- Two tables:
--   * push_subscriptions  — one row per (user, browser endpoint). Carries the
--     keys web-push needs to encrypt a payload, plus the device timezone
--     captured at subscribe time so the cron route can decide locally-correct
--     fire times. Cascade on auth.users delete keeps cleanup automatic when
--     an account is removed.
--   * reminder_schedules  — one row per (user, habit-with-timeOfDay). The
--     client diffs this against Dexie on every habit write so the server view
--     stays current. `last_fired_at` is the server-side dedupe marker: cron
--     skips a habit if its last fire is in the same UTC date+hour as `now`.
--
-- RLS pins both tables to the authenticated user. The hourly cron route
-- bypasses RLS by using the secret (service_role) key.

create table push_subscriptions (
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  timezone    text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "users manage their own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table reminder_schedules (
  user_id       uuid not null references auth.users(id) on delete cascade,
  habit_id      text not null,
  title         text not null,
  tab           text not null,
  days          smallint[] not null,
  time_local    text not null,
  timezone      text not null,
  last_fired_at timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, habit_id)
);

alter table reminder_schedules enable row level security;

create policy "users manage their own schedules"
  on reminder_schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index reminder_schedules_user_idx on reminder_schedules (user_id);
