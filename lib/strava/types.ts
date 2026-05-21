// Strava response shapes. Subset of the fields we actually consume from
// the `/api/v3/athlete/activities` summary endpoint and OAuth token response.
// Safe to import from either client or server modules.

export type StravaActivityType =
  | "Run"
  | "TrailRun"
  | "VirtualRun"
  | "Ride"
  | "VirtualRide"
  | "EBikeRide"
  | "MountainBikeRide"
  | "Walk"
  | "Hike"
  | "Swim"
  | "WeightTraining"
  | "Workout"
  | "Crossfit"
  | "HighIntensityIntervalTraining"
  | (string & {}); // catch-all for the long tail Strava adds over time

export type StravaSummaryActivity = {
  id: number;
  name: string;
  // Strava's docs prefer `sport_type` (newer) over `type`; we read both.
  sport_type?: StravaActivityType;
  type?: StravaActivityType;
  start_date: string;            // ISO 8601 UTC
  start_date_local?: string;     // ISO 8601 local (no zone)
  moving_time: number;           // seconds
  elapsed_time: number;          // seconds
  distance: number;              // metres
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: { id: string; summary_polyline?: string };
};

export type StravaTokenResponse = {
  token_type: "Bearer";
  expires_at: number;            // epoch seconds
  expires_in: number;            // seconds until expiry
  refresh_token: string;
  access_token: string;
  athlete?: { id: number; firstname?: string; lastname?: string };
};
