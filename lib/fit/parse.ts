"use client";

import FitParser, { type FitParserOptions } from "fit-file-parser";

// Step 9 — thin adapter over `fit-file-parser`. The upstream package only
// exports its main entry (no deep paths in `exports`), so we declare a narrow
// local subset of the ParsedFit shape covering exactly the fields map.ts
// reads. Anything we don't list is ignored.

export type FitRecord = {
  timestamp?: string;        // ISO datetime
  heart_rate?: number;
};

export type FitSession = {
  start_time?: string;       // ISO datetime — required in practice
  sport?: string;
  sub_sport?: string;
  total_elapsed_time?: number;   // seconds
  total_timer_time?: number;     // seconds (moving time)
  total_distance?: number;       // metres
  total_calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  avg_speed?: number;
  max_speed?: number;
  total_ascent?: number;
  total_descent?: number;
  num_laps?: number;
};

export type ParsedFit = {
  sessions?: FitSession[];
  records?: FitRecord[];
};

// Hard ceiling on file size — Garmin watches produce sub-MB FIT files even
// for marathon-length activities. Anything bigger is almost certainly a
// multi-day monitoring file or corruption; refuse rather than block the UI
// while we crunch it.
export const MAX_FIT_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const PARSER_OPTIONS: FitParserOptions = {
  // Metric units throughout — converted at render time per Settings.units.
  speedUnit: "m/s",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  pressureUnit: "bar",
  // `list` flattens session/lap/record into top-level arrays. That's what
  // map.ts expects to walk.
  mode: "list",
  // Continue past minor checksum complaints — Garmin watches occasionally
  // emit FIT files that the strict parser rejects but contain valid data.
  force: true,
};

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // FileReader gives us a stable promise API across browsers; the newer
  // `file.arrayBuffer()` works in Chrome/Android but FileReader is safer.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("File read produced non-binary result"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseFitFile(file: File): Promise<ParsedFit> {
  if (file.size > MAX_FIT_FILE_BYTES) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)}MB; max ${(
        MAX_FIT_FILE_BYTES /
        1024 /
        1024
      ).toFixed(0)}MB.`,
    );
  }
  const buffer = await readFileAsArrayBuffer(file);
  const parser = new FitParser(PARSER_OPTIONS);
  // Upstream's `parseAsync` is typed against its internal ParsedFit; we cast
  // through unknown to our narrow subset that lists only the fields we use.
  const raw = (await parser.parseAsync(buffer)) as unknown;
  return raw as ParsedFit;
}
