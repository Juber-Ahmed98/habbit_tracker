// Thin wrapper around navigator.vibrate so callers don't need to feature-detect.
// Per §9: short tap (12ms) for completion, double-tap pattern for milestones.

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore: some browsers throw inside iframes or on user-gesture violations
  }
}

export const HAPTIC_TAP = 12;
export const HAPTIC_LONG_PRESS = 8;
export const HAPTIC_MILESTONE: number[] = [8, 40, 8];

// Streak-day milestones that fire HAPTIC_MILESTONE instead of HAPTIC_TAP
// when a tick crosses them. Mirrors the StreakFlame visual breakpoints
// (3 = pulse on, 7 = flame fills, 30 = glow) plus 100 as a "you really
// kept going" reward.
export const STREAK_MILESTONES: readonly number[] = [3, 7, 30, 100];

// Returns the highest milestone just crossed by a tick (prev → next), or
// null if none. "Crossed" means next reached or passed it while prev was
// strictly below — so re-ticking the same milestone day doesn't re-fire.
export function milestoneCrossed(prev: number, next: number): number | null {
  if (next <= prev) return null;
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (prev < m && next >= m) hit = m;
  }
  return hit;
}
