import {
  type FitnessSession,
  type FitnessSessionType,
} from "@/lib/db/schema";
import type { FitRecord, FitSession, ParsedFit } from "./parse";

// Step 9 — convert `fit-file-parser`'s ParsedFit into FitnessSession candidates.
// FIT files often contain one `session`, but a multisport file (triathlon,
// brick) contains several — each becomes its own row.

// Sport (and a handful of sub_sports that are coarser-grained than `sport`)
// → our 6-bucket FitnessSessionType. Anything we don't recognise lands on
// "other" so the import still succeeds.
function mapSport(
  sport: string | undefined,
  subSport: string | undefined,
): FitnessSessionType {
  // Sub-sport overrides for cases where the watch picks a generic sport.
  if (subSport === "treadmill" || subSport === "trail") return "run";
  if (subSport === "indoor_cycling" || subSport === "spin") return "ride";
  if (subSport === "strength_training" || subSport === "cardio_training") {
    return "gym";
  }
  switch (sport) {
    case "running":
      return "run";
    case "cycling":
    case "e_biking":
      return "ride";
    case "walking":
    case "hiking":
      return "walk";
    case "swimming":
      return "swim";
    case "training":
    case "fitness_equipment":
    case "rock_climbing":
    case "floor_climbing":
    case "boxing":
    case "tactical":
      return "gym";
    default:
      return "other";
  }
}

// Per §6 dedupe note: when `externalId` is absent we fall back to a
// `(startedAt ± 60s, durationSec ± 60s)` window. For FIT we *do* compute a
// stable id from the session's intrinsic timing so re-importing the same file
// is a clean no-op. The hash is deterministic across runs.
function externalIdFor(startedAt: number, durationSec: number, sport: string): string {
  // Round startedAt to the nearest second to avoid floating-ms drift between
  // re-parses; sport included so a multisport file's run+ride at the same
  // start_time don't collide.
  const sec = Math.round(startedAt / 1000);
  return `fit:${sec}:${Math.round(durationSec)}:${sport}`;
}

// Downsample a HR series to at most TARGET_POINTS. Same target as the BLE /
// Strava paths so the detail chart renders consistently regardless of source.
const TARGET_POINTS = 600;

function downsampleHr(
  series: Array<{ t: number; bpm: number }>,
): Array<{ t: number; bpm: number }> {
  if (series.length <= TARGET_POINTS) return series;
  const stride = Math.ceil(series.length / TARGET_POINTS);
  const out: Array<{ t: number; bpm: number }> = [];
  for (let i = 0; i < series.length; i += stride) out.push(series[i]);
  return out;
}

// Records carry `timestamp` as an ISO string. We slice to those that fall
// inside this session's time window so a multisport file doesn't crosstalk
// HR samples between disciplines.
function buildHrSeries(
  records: FitRecord[] | undefined,
  startedAtMs: number,
  durationSec: number,
): Array<{ t: number; bpm: number }> | undefined {
  if (!records || records.length === 0) return undefined;
  const endMs = startedAtMs + durationSec * 1000;
  const series: Array<{ t: number; bpm: number }> = [];
  for (const r of records) {
    const ts = r.timestamp ? Date.parse(r.timestamp) : NaN;
    if (!Number.isFinite(ts)) continue;
    if (ts < startedAtMs || ts > endMs + 60_000) continue;
    if (typeof r.heart_rate !== "number" || r.heart_rate <= 0) continue;
    series.push({ t: ts - startedAtMs, bpm: r.heart_rate });
  }
  if (series.length === 0) return undefined;
  return downsampleHr(series);
}

function mapSession(
  session: FitSession,
  allRecords: FitRecord[] | undefined,
): FitnessSession | null {
  if (!session.start_time) return null;
  const startedAt = Date.parse(session.start_time);
  if (!Number.isFinite(startedAt)) return null;
  // Prefer timer time (moving) over elapsed (wall-clock incl. pauses); fall
  // back to elapsed if timer is missing.
  const durationSec = Math.round(
    session.total_timer_time ?? session.total_elapsed_time ?? 0,
  );
  if (durationSec <= 0) return null;

  const sport = session.sport ?? "generic";
  const type = mapSport(session.sport, session.sub_sport);
  const hrSeries = buildHrSeries(allRecords, startedAt, durationSec);

  return {
    id: crypto.randomUUID(),
    source: "fit",
    externalId: externalIdFor(startedAt, durationSec, sport),
    startedAt,
    durationSec,
    type,
    distanceM:
      session.total_distance && session.total_distance > 0
        ? Math.round(session.total_distance)
        : undefined,
    avgHr: session.avg_heart_rate,
    maxHr: session.max_heart_rate,
    calories:
      session.total_calories && session.total_calories > 0
        ? Math.round(session.total_calories)
        : undefined,
    hrSeries,
    // Store only the high-level descriptors. Full record streams can be MBs
    // and aren't useful once we've collapsed them into hrSeries.
    raw: {
      sport,
      sub_sport: session.sub_sport,
      total_elapsed_time: session.total_elapsed_time,
      total_ascent: session.total_ascent,
      total_descent: session.total_descent,
      avg_speed: session.avg_speed,
      max_speed: session.max_speed,
      num_laps: session.num_laps,
    },
  };
}

export function mapFitToSessions(parsed: ParsedFit): FitnessSession[] {
  const sessions = parsed.sessions ?? [];
  if (sessions.length === 0) return [];
  const out: FitnessSession[] = [];
  for (const s of sessions) {
    const mapped = mapSession(s, parsed.records);
    if (mapped) out.push(mapped);
  }
  return out;
}
