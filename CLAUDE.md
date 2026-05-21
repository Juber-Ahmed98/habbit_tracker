# Habit Tracker — Claude working notes

You are helping the user build a personal habit-tracker PWA. This file is the
contract for how to collaborate. Read it on every session start.

## The spec is authoritative

The spec lives at `docs/habit-tracker-spec.md`. Read it before proposing
anything — especially §13 (build order) and §3 / §5 / §6 / §11 for whichever
step you're on.

## Standing constraints (from the user, verbatim)

- **Follow the build order in §13 strictly — do not jump ahead.**
- **Use pnpm.** Never npm or yarn.
- **Commit after each meaningful unit of work with clear messages.** Local
  commits only — the user pushes manually via GitHub Desktop. Don't `git push`.
- **Ask anything ambiguous, flag any spec decisions you'd push back on, and
  tell me what you plan to do. Don't begin coding until I confirm.**
- **If you hit a decision the spec doesn't cover, stop and ask rather than
  guessing.**

## Deviations from spec the user has accepted

- **Deploy target is Vercel, not Netlify.** Translate any §14 "Netlify
  Function" reference to a Vercel API route (`app/api/*/route.ts`,
  `runtime = "nodejs"`).
- **Per spec §14, never expose secrets to the client.** Strava tokens live
  only in an HMAC-signed httpOnly cookie set by the server proxy; the client
  never sees them. `.env.local` holds the secrets and is gitignored.
- **Notifications are deferred to Step 11 (cloud sync).** Step 5's notifications
  toggle is a disabled placeholder.
- **Web Bluetooth is Android-Chrome-only** (per spec §0 target). iOS Safari /
  Firefox / Brave get an "unsupported" view. Brave specifically has stricter
  permission sandboxing — works on Chrome, not Brave, on the same device.

## Build progress

- Steps 1–8 are shipped on `main`. Run `git log --oneline -25` for the
  authoritative history before proposing anything.
- **Step 9 is next: FIT file import via `fit-file-parser`** (§13.9).
- Steps 10 (polish), 11 (Supabase cloud sync + Garmin Health API +
  notifications) follow.

## Key architectural decisions worth remembering

- **Dexie schema is at v4.** Bump the version + add an `upgrade()` block on
  any breaking change; see `lib/db/index.ts`.
- **Catalogue seeding lives in onboarding (Step 5), not at hydration.** The
  `AppHydrator` only does Settings hydrate + a one-off Fitness backfill +
  debounced Strava sync.
- **Habit completions carry a `source` field** (`manual` / `strava` / `ble` /
  `garmin` / `fit` / `freeze`) so Insights can later distinguish auto vs
  manual ticks. Auto-tick rule: any Gym-type session ticks the Gym habit
  (§3 Tier 1) — implemented identically across manual / Strava / BLE paths.
- **`/fitness/live` is a full-screen `position: fixed` overlay**, not a route
  outside the `(tabs)` group, because Next App Router can't share URL
  segments across route groups. The overlay just sits on top of the BottomNav.
- **`useSyncExternalStore` is used for browser-capability gates** (BLE
  support, snapshot recovery) to avoid hydration mismatches. The server
  snapshot is optimistic (`true`) so capable browsers don't flash the
  unsupported view.

## Lint quirks to be aware of

The project uses React Compiler's strict rules:
- `react-hooks/set-state-in-effect` — no `setState` in `useEffect` bodies.
  Workarounds: derive synchronously during render, use `useSyncExternalStore`,
  or use `useMemo` from a synchronous source.
- `react-hooks/refs` — no reading `ref.current` during render.
- `react-hooks/purity` — no `Date.now()` etc. inside `useMemo`. Pipe a ticked
  state value in instead.

The lone accepted warning is `react-hooks/incompatible-library` in
`CreateHabitDialog.tsx` (React Hook Form's `watch()`) — leave it.

## Working style preferences (observed)

- The user verifies each step manually before greenlighting the next. Don't
  rush to the next step or batch multiple steps in one session.
- Pushback is welcome before coding, not after. Surface tradeoffs as a
  bulleted list and ask via `AskUserQuestion` with concrete options when the
  decision matters.
- Keep responses terse. The user reads diffs; don't re-summarize what changed
  unless asked.
