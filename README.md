# Habit Tracker

A personal habit tracker PWA across five domains: Dashboard, Fitness, Work, Deen, Lifestyle.
Source-of-truth spec: `habit-tracker-spec.md` (local; not in repo).

## Status

**Step 1 of [§13 build order]: shell only.**

- Next.js 16 + React 19 + TypeScript strict
- Tailwind v4 (CSS-first theme config)
- Theme tokens (spec §4) wired as CSS variables — light + dark, manual override via `data-theme`
- Bottom-tab shell with five empty tabs (`/dashboard`, `/fitness`, `/work`, `/deen`, `/lifestyle`)
- Settings + onboarding stubs
- PWA: manifest + Serwist service worker, installable on Android Chrome

Habit data, streaks, Garmin integrations, notifications, etc. all come in later steps.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000 (turbopack)
pnpm build        # production build via webpack (see "Webpack vs Turbopack" below)
pnpm start        # serve the build
pnpm icons        # regenerate placeholder PWA icons
```

The service worker is **disabled in dev** (`next.config.ts`) so HMR doesn't fight the cache. To test PWA install behavior, run `pnpm build && pnpm start` and visit on Android.

## Installing as a PWA on the Galaxy S24 Ultra

1. Open the deployed URL in **Chrome** (not Samsung Internet — fewer caveats).
2. Tap the address bar menu → **Install app** (or wait for the install banner).
3. The app launches in standalone mode, respects the punch-hole via `viewport-fit=cover`, and uses the maskable icon on the home screen.
4. Themed icons (Android 13+ "Themed icons" setting) pick up the monochrome variant automatically.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New Project → Import Git Repository**, pick the repo.
3. Vercel auto-detects Next.js — no build settings to change. `vercel.json` handles the no-cache headers for `/sw.js` and `/manifest.json`.
4. Wait for the first deploy, then install the PWA from the Vercel URL.

Environment variables (Strava, Supabase, Garmin) go in **Project Settings → Environment Variables** when those integrations land in later steps.

## Webpack vs Turbopack

Next 16 uses Turbopack by default. Serwist 9.x doesn't yet produce a working SW under Turbopack production builds ([serwist#54](https://github.com/serwist/serwist/issues/54)), so `pnpm build` passes `--webpack` explicitly. `pnpm dev` stays on Turbopack since the SW is disabled in dev anyway. Once Serwist + Turbopack ships, drop the flag.

## Theme

Defined in `app/globals.css`. Both palettes from spec §4 are sourced from CSS variables; Tailwind utility classes (`bg-bg`, `text-text-muted`, `border-border`, `bg-accent`, etc.) map via `@theme inline`. Switch modes manually via:

```js
document.documentElement.dataset.theme = 'dark'; // or 'light', or remove to follow system
localStorage.setItem('theme', 'dark');
```

The inline bootstrap script in `app/layout.tsx` applies a persisted theme before paint to avoid the flash-of-wrong-mode.

## Project layout

```
app/
  (tabs)/                # route group with the bottom-nav layout
    layout.tsx           # bottom nav + safe-area-aware main scroll area
    BottomNav.tsx        # five-tab client component
    dashboard/page.tsx
    fitness/page.tsx
    work/page.tsx
    deen/page.tsx
    lifestyle/page.tsx
  settings/page.tsx
  onboarding/page.tsx
  layout.tsx             # root: viewport + theme bootstrap + SW registration
  globals.css            # theme tokens + Tailwind
  sw.ts                  # service worker source (built by Serwist)
  sw-register.tsx        # client-side SW registration
public/
  manifest.json
  icons/                 # placeholder PWA icons (regenerate with `pnpm icons`)
scripts/
  generate-icons.mjs
```
