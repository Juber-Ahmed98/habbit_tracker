// Shared push-payload shape. The SW (app/sw.ts) parses this; the cron route
// (app/api/cron/reminders) + the test route construct it. Keep both ends in
// lock-step with this type — there's no JSON schema validation at the wire.

export type PushPayload = {
  title: string;
  body: string;
  /** Path within the app to focus / open on click. e.g. "/fitness". */
  deepLink: string;
  /** Stable per-habit identifier; used as the Notification `tag` so a
   *  re-fire replaces the previous notification instead of stacking. */
  habitId: string;
};
