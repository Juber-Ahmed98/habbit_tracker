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
export const HAPTIC_MILESTONE: number[] = [8, 40, 8];
