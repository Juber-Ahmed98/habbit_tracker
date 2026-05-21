import {
  type FitnessSession,
  type FitnessSessionType,
} from "@/lib/db/schema";
import { type StravaActivityType, type StravaSummaryActivity } from "./types";

// Strava's `sport_type` taxonomy is much wider than our coarse enum. Anything
// not in the map falls back to "other"; gym-ish work types collapse onto
// "gym" so the Gym/Workout habit ticks automatically.
const TYPE_MAP: Partial<Record<StravaActivityType, FitnessSessionType>> = {
  Run: "run",
  TrailRun: "run",
  VirtualRun: "run",
  Ride: "ride",
  VirtualRide: "ride",
  EBikeRide: "ride",
  MountainBikeRide: "ride",
  Walk: "walk",
  Hike: "walk",
  Swim: "swim",
  WeightTraining: "gym",
  Workout: "gym",
  Crossfit: "gym",
  HighIntensityIntervalTraining: "gym",
};

export function mapStravaType(
  type: StravaActivityType | undefined,
): FitnessSessionType {
  if (!type) return "other";
  return TYPE_MAP[type] ?? "other";
}

// Build a FitnessSession from a Strava summary activity. We use moving_time
// rather than elapsed_time because the user cares about active minutes — the
// `raw` field stashes everything else for the detail view to reach into.
export function mapStravaActivity(
  activity: StravaSummaryActivity,
): FitnessSession {
  const type = mapStravaType(activity.sport_type ?? activity.type);
  // Prefer the local start date so the session lands on the correct
  // calendar day even when the user has crossed timezones since.
  const startedAt = new Date(
    activity.start_date_local ?? activity.start_date,
  ).getTime();
  return {
    id: crypto.randomUUID(),
    source: "strava",
    externalId: String(activity.id),
    startedAt,
    durationSec: activity.moving_time,
    type,
    name: activity.name,
    distanceM: activity.distance > 0 ? activity.distance : undefined,
    avgHr: activity.average_heartrate,
    maxHr: activity.max_heartrate,
    // Calories aren't in the list endpoint — would need per-activity detail
    // fetches. Skip for now; they'll show as — in the detail sheet.
    raw: {
      polyline: activity.map?.summary_polyline,
      start_latlng: activity.start_latlng,
      end_latlng: activity.end_latlng,
      elapsed_time: activity.elapsed_time,
      total_elevation_gain: activity.total_elevation_gain,
    },
  };
}
