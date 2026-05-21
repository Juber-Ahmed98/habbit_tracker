// %-of-max HR zones. Spec §3 (Garmin Tier 2 BLE live HR) calls for a Z1–Z5
// indicator; we use the simple percent-of-max scheme since onboarding doesn't
// capture resting HR yet (Karvonen needs it).

export type HrZone = 1 | 2 | 3 | 4 | 5;

export type ZoneBand = {
  zone: HrZone;
  label: string;
  minPct: number; // inclusive lower bound as fraction of maxHr
  maxPct: number; // exclusive upper bound; Z5 caps at Infinity
  color: string;  // CSS var keyword for the zone bar / BPM tint
};

export const ZONE_BANDS: ZoneBand[] = [
  { zone: 1, label: "Z1 · Recovery",  minPct: 0.00, maxPct: 0.60, color: "var(--zone-1)" },
  { zone: 2, label: "Z2 · Easy",      minPct: 0.60, maxPct: 0.70, color: "var(--zone-2)" },
  { zone: 3, label: "Z3 · Aerobic",   minPct: 0.70, maxPct: 0.80, color: "var(--zone-3)" },
  { zone: 4, label: "Z4 · Threshold", minPct: 0.80, maxPct: 0.90, color: "var(--zone-4)" },
  { zone: 5, label: "Z5 · Max",       minPct: 0.90, maxPct: Infinity, color: "var(--zone-5)" },
];

export function computeZone(bpm: number, maxHr: number): HrZone {
  if (!Number.isFinite(maxHr) || maxHr <= 0) return 1;
  const pct = bpm / maxHr;
  for (const band of ZONE_BANDS) {
    if (pct >= band.minPct && pct < band.maxPct) return band.zone;
  }
  return 5;
}

export function zoneBand(z: HrZone): ZoneBand {
  return ZONE_BANDS[z - 1];
}
