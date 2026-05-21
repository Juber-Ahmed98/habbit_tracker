// Distance / duration formatters shared across the Fitness tab. Honours
// Settings.units when imperial is selected; defaults to metric.

import { type UnitSystem } from "../db/schema";

const METRES_PER_MILE = 1609.344;

export function formatDistance(
  metres: number | undefined,
  units: UnitSystem = "metric",
): string | null {
  if (metres === undefined || metres <= 0) return null;
  if (units === "imperial") {
    const miles = metres / METRES_PER_MILE;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

// "1h 23m" or "23 min" — compact, no seconds (manual entry granularity).
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
