"use client";

import { ChevronLeft, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import {
  connectHeartRateMonitor,
  type HeartRateConnection,
  type HeartRateSample,
  isHeartRateSupported,
} from "@/lib/ble/heartRate";
import { type FitnessSessionType } from "@/lib/db/schema";
import { useFitnessStore } from "@/lib/stores/fitness";
import { useSettingsStore } from "@/lib/stores/settings";
import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  type LiveSnapshot,
} from "@/lib/utils/liveSession";
import {
  computeZone,
  ZONE_BANDS,
  zoneBand,
  type HrZone,
} from "@/lib/utils/zones";

// §3 Tier 2 — Web Bluetooth live HR monitor + workout logger.
// Full-screen overlay (covers the BottomNav via fixed-position root).
// State machine handles BLE feature gating, the pre-pair setup, the active
// recording loop, and the save step. Snapshot to localStorage every 5s so a
// tab close mid-workout can be recovered on next visit.

type Phase =
  | "setup"        // type picker + (optional) maxHr input + Pair button
  | "pairing"      // requestDevice in flight
  | "active"       // notifications flowing
  | "stopping"     // confirming + writing to Dexie
  | "unsupported"; // browser has no navigator.bluetooth

const ROLLING_WINDOW_MS = 60_000;
const SNAPSHOT_INTERVAL_MS = 5_000;

const TYPE_OPTIONS: Array<{ value: FitnessSessionType; label: string }> = [
  { value: "gym", label: "Gym" },
  { value: "run", label: "Run" },
  { value: "ride", label: "Ride" },
  { value: "other", label: "Other" },
];

export default function LiveWorkoutPage() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const createBleSession = useFitnessStore((s) => s.createBleSession);

  // BLE feature gate via useSyncExternalStore. Server snapshot is `true`
  // (optimistic) so capable browsers don't flash the unsupported view during
  // hydration; only truly unsupported browsers see a brief flash to the
  // unsupported view as the post-hydration snapshot settles.
  const supported = useSyncExternalStore(
    subscribeNoop,
    isHeartRateSupported,
    returnTrue,
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<FitnessSessionType>("gym");
  const [maxHrDraft, setMaxHrDraft] = useState<string>("");

  // Snapshot read via useSyncExternalStore so the value is stable across
  // renders (cached at module scope) and SSR gets a deterministic `null`.
  const recoverable = useSyncExternalStore(
    subscribeSnapshot,
    getSnapshotCached,
    returnNull,
  );

  const effectivePhase: Phase = supported ? phase : "unsupported";

  // Active-session state. We keep `samples` for the chart + finalised series,
  // and a `now` clock to drive the elapsed timer.
  const [samples, setSamples] = useState<HeartRateSample[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);

  const connectionRef = useRef<HeartRateConnection | null>(null);
  const lastSampleSecondRef = useRef<number>(0);

  // Tick the timer once a second while active.
  useEffect(() => {
    if (effectivePhase !== "active") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [effectivePhase]);

  // Periodic snapshot persist while active.
  useEffect(() => {
    if (effectivePhase !== "active" || startedAt === null) return;
    const id = window.setInterval(() => {
      saveSnapshot({
        startedAt,
        type: sessionType,
        deviceName: deviceName ?? undefined,
        hrSeries: samples,
        updatedAt: Date.now(),
      });
    }, SNAPSHOT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [effectivePhase, startedAt, sessionType, deviceName, samples]);

  // Clean up the BLE connection if the user leaves the page mid-workout.
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, []);

  const maxHr = settings.maxHr ?? 0;

  const beginPair = useCallback(async () => {
    setErrorText(null);
    setPhase("pairing");
    try {
      const conn = await connectHeartRateMonitor();
      connectionRef.current = conn;
      setDeviceName(conn.deviceName);
      const begin = Date.now();
      setStartedAt(begin);
      setSamples([]);
      lastSampleSecondRef.current = 0;
      conn.onSample((s) => {
        // Downsample to 1 sample/sec — straps notify ~every second anyway
        // but some report 2–4Hz. Keying on Math.floor(t/1000) collapses them.
        const secKey = Math.floor(s.t / 1000);
        if (secKey === lastSampleSecondRef.current) return;
        lastSampleSecondRef.current = secKey;
        setSamples((prev) => [...prev, s]);
      });
      conn.onDisconnect(() => {
        setErrorText(
          "Heart rate monitor disconnected. Tap Stop to save what we have.",
        );
      });
      setPhase("active");
    } catch (err) {
      // User cancelling the picker also throws; treat as a soft reset.
      setPhase("setup");
      if (err instanceof Error && err.name === "NotFoundError") {
        // No device chosen — silent return to setup.
        return;
      }
      setErrorText(
        err instanceof Error ? err.message : "Couldn't pair the monitor.",
      );
    }
  }, []);

  const saveAndExit = useCallback(
    async (discard = false) => {
      const conn = connectionRef.current;
      conn?.disconnect();
      connectionRef.current = null;

      if (discard || startedAt === null || samples.length === 0) {
        clearSnapshot();
        router.replace("/fitness");
        return;
      }

      setPhase("stopping");
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAt) / 1000),
      );
      await createBleSession({
        type: sessionType,
        startedAt,
        durationSec,
        hrSeries: samples,
        deviceName: deviceName ?? undefined,
      });
      clearSnapshot();
      router.replace("/fitness");
    },
    [createBleSession, deviceName, router, samples, sessionType, startedAt],
  );

  const cancelSetup = useCallback(() => {
    router.replace("/fitness");
  }, [router]);

  const saveMaxHrDraft = useCallback(async () => {
    const parsed = Number.parseInt(maxHrDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 80 || parsed > 230) return;
    await updateSettings({ maxHr: parsed });
    setMaxHrDraft("");
  }, [maxHrDraft, updateSettings]);

  // Resume from a snapshot — wipes any current state and reopens the picker
  // with the previous type pre-selected. We deliberately don't auto-pair: the
  // strap may not be on, and re-pairing always requires user gesture.
  const resumeSnapshot = useCallback(() => {
    if (!recoverable) return;
    setSessionType(recoverable.type);
    setStartedAt(recoverable.startedAt);
    setSamples(recoverable.hrSeries);
    setDeviceName(recoverable.deviceName ?? null);
    clearSnapshotCache(); // hides the resume card; user re-pairs explicitly
  }, [recoverable]);

  const discardSnapshot = useCallback(() => {
    clearSnapshot();
    clearSnapshotCache();
  }, []);

  const latest = samples[samples.length - 1];
  const currentBpm = latest?.bpm;
  const currentZone: HrZone | null =
    currentBpm !== undefined && maxHr > 0
      ? computeZone(currentBpm, maxHr)
      : null;

  // Rolling-window chart data. `now` ticks once per second while active so
  // the window slides even before the next sample arrives.
  const chartData = useMemo(() => {
    if (samples.length === 0) return [];
    const cutoff = (latest?.t ?? now) - ROLLING_WINDOW_MS;
    return samples
      .filter((s) => s.t >= cutoff)
      .map((s) => ({ t: s.t, bpm: s.bpm }));
  }, [samples, latest, now]);

  const elapsedSec =
    startedAt !== null && effectivePhase === "active"
      ? Math.max(0, Math.round((now - startedAt) / 1000))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        backgroundColor: "var(--bg)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <header
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button
          type="button"
          aria-label="Close live workout"
          onClick={() =>
            effectivePhase === "active"
              ? void saveAndExit(true)
              : cancelSetup()
          }
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          {effectivePhase === "active" ? (
            <X size={20} />
          ) : (
            <ChevronLeft size={20} />
          )}
        </button>
        <h1 className="text-lg font-semibold text-text">Live workout</h1>
        {effectivePhase === "active" ? (
          <span
            className="ml-auto font-mono text-sm tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {formatElapsed(elapsedSec)}
          </span>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {effectivePhase === "unsupported" ? (
          <UnsupportedView onBack={cancelSetup} />
        ) : effectivePhase === "setup" ? (
          <SetupView
            recoverable={recoverable}
            onResume={resumeSnapshot}
            onDiscardSnapshot={discardSnapshot}
            sessionType={sessionType}
            onTypeChange={setSessionType}
            maxHr={settings.maxHr}
            maxHrDraft={maxHrDraft}
            onMaxHrDraftChange={setMaxHrDraft}
            onSaveMaxHr={() => void saveMaxHrDraft()}
            onPair={() => void beginPair()}
            errorText={errorText}
          />
        ) : effectivePhase === "pairing" ? (
          <PairingView />
        ) : effectivePhase === "active" ? (
          <ActiveView
            bpm={currentBpm}
            zone={currentZone}
            maxHr={maxHr}
            chartData={chartData}
            deviceName={deviceName}
            errorText={errorText}
            onStop={() => void saveAndExit(false)}
          />
        ) : (
          <StoppingView />
        )}
      </main>
    </div>
  );
}

// -- helpers ----------------------------------------------------------------

// useSyncExternalStore plumbing for the BLE feature gate. There's no actual
// external store to subscribe to (support is static once the page mounts), so
// the subscribe fn is a no-op and the snapshot is just a fresh capability read.
function subscribeNoop(): () => void {
  return () => {};
}
function returnTrue(): true {
  return true;
}
function returnNull(): null {
  return null;
}

// Module-scope cache for the live-session snapshot. useSyncExternalStore
// requires getSnapshot to return a stable reference for unchanged state, so we
// parse localStorage once per page lifetime and invalidate via the subscriber.
let snapshotCache: LiveSnapshot | null | undefined = undefined;
const snapshotListeners = new Set<() => void>();

function getSnapshotCached(): LiveSnapshot | null {
  if (snapshotCache === undefined) {
    snapshotCache = loadSnapshot();
  }
  return snapshotCache;
}
function subscribeSnapshot(cb: () => void): () => void {
  snapshotListeners.add(cb);
  return () => snapshotListeners.delete(cb);
}
function clearSnapshotCache(): void {
  snapshotCache = null;
  for (const cb of snapshotListeners) cb();
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// -- subviews ---------------------------------------------------------------

function UnsupportedView({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-12 text-center">
      <h2 className="text-lg font-semibold text-text">
        Live HR isn&apos;t supported here
      </h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Web Bluetooth is only available in Android Chrome (and a few other
        Chromium browsers). iOS Safari and Firefox don&apos;t expose it. Open
        this page on an Android device to use live HR, or log the workout
        manually instead.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
        style={{
          backgroundColor: "var(--surface-alt)",
          color: "var(--text)",
          border: "1px solid var(--border)",
        }}
      >
        Back to Fitness
      </button>
    </div>
  );
}

function SetupView({
  recoverable,
  onResume,
  onDiscardSnapshot,
  sessionType,
  onTypeChange,
  maxHr,
  maxHrDraft,
  onMaxHrDraftChange,
  onSaveMaxHr,
  onPair,
  errorText,
}: {
  recoverable: LiveSnapshot | null;
  onResume: () => void;
  onDiscardSnapshot: () => void;
  sessionType: FitnessSessionType;
  onTypeChange: (t: FitnessSessionType) => void;
  maxHr: number | undefined;
  maxHrDraft: string;
  onMaxHrDraftChange: (s: string) => void;
  onSaveMaxHr: () => void;
  onPair: () => void;
  errorText: string | null;
}) {
  return (
    <div className="space-y-4">
      {recoverable ? (
        <section
          className="space-y-2 rounded-card px-3 py-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-sm font-medium text-text">
            Resume previous workout?
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {recoverable.hrSeries.length} samples from{" "}
            {new Date(recoverable.startedAt).toLocaleTimeString()}.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onResume}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={onDiscardSnapshot}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--surface-alt)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              Discard
            </button>
          </div>
        </section>
      ) : null}

      <section
        className="space-y-2 rounded-card px-3 py-3"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Activity type
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const on = sessionType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTypeChange(opt.value)}
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={{
                  backgroundColor: on
                    ? "var(--accent)"
                    : "var(--surface-alt)",
                  color: on ? "var(--accent-ink)" : "var(--text)",
                  border: on ? "none" : "1px solid var(--border)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {!maxHr ? (
        <section
          className="space-y-2 rounded-card px-3 py-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Max heart rate
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Used for Z1–Z5 zone bands. A common starting point is 220 minus your
            age. You can change this later in Settings.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder="190"
              value={maxHrDraft}
              onChange={(e) => onMaxHrDraftChange(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--surface-alt)",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            />
            <button
              type="button"
              onClick={onSaveMaxHr}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              Save
            </button>
          </div>
        </section>
      ) : (
        <section
          className="rounded-card px-3 py-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-sm text-text">
            Max HR:{" "}
            <span className="font-semibold tabular-nums">{maxHr}</span> bpm.
            <span
              className="ml-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Change in Settings.
            </span>
          </p>
        </section>
      )}

      {errorText ? (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
          }}
        >
          {errorText}
        </div>
      ) : null}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Put on the chest strap and enable Broadcast HR on your watch (Garmin:
        Menu &rarr; Sensors &rarr; Broadcast Heart Rate). Then tap Pair.
      </p>

      <button
        type="button"
        onClick={onPair}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-ink)",
        }}
      >
        Pair heart rate monitor
      </button>
    </div>
  );
}

function PairingView() {
  return (
    <div className="mx-auto max-w-sm space-y-3 pt-12 text-center">
      <p className="text-sm font-medium text-text">Waiting for device…</p>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Pick your strap in the browser dialog.
      </p>
    </div>
  );
}

function StoppingView() {
  return (
    <div className="mx-auto max-w-sm space-y-3 pt-12 text-center">
      <p className="text-sm font-medium text-text">Saving session…</p>
    </div>
  );
}

function ActiveView({
  bpm,
  zone,
  maxHr,
  chartData,
  deviceName,
  errorText,
  onStop,
}: {
  bpm: number | undefined;
  zone: HrZone | null;
  maxHr: number;
  chartData: Array<{ t: number; bpm: number }>;
  deviceName: string | null;
  errorText: string | null;
  onStop: () => void;
}) {
  const tint = zone ? zoneBand(zone).color : "var(--text-muted)";
  return (
    <div className="space-y-5">
      <section className="text-center">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {deviceName ?? "Heart rate"}
        </p>
        <p
          className="font-semibold tabular-nums"
          style={{
            color: tint,
            fontSize: "84px",
            lineHeight: 1,
            marginTop: "6px",
          }}
        >
          {bpm ?? "—"}
        </p>
        <p
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {zone ? zoneBand(zone).label : "Waiting for first sample…"}
        </p>
      </section>

      <section
        className="rounded-card px-3 py-3"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Last 60 seconds
        </p>
        <div className="mt-2 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="hr-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tint} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={tint} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                domain={[40, "auto"]}
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Area
                type="monotone"
                dataKey="bpm"
                stroke={tint}
                strokeWidth={2}
                fill="url(#hr-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {maxHr > 0 ? (
        <section
          className="rounded-card px-3 py-3"
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Zones
          </p>
          <div className="mt-2 space-y-1">
            {ZONE_BANDS.map((band) => {
              const active = zone === band.zone;
              return (
                <div
                  key={band.zone}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px]"
                  style={{
                    backgroundColor: active
                      ? "var(--surface-alt)"
                      : "transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: band.color }}
                  />
                  <span
                    className="flex-1"
                    style={{
                      color: active ? "var(--text)" : "var(--text-muted)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {band.label}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {Math.round(band.minPct * maxHr)}
                    {band.maxPct === Infinity
                      ? "+"
                      : `–${Math.round(band.maxPct * maxHr)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {errorText ? (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
          }}
        >
          {errorText}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onStop}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold"
        style={{
          backgroundColor: "var(--danger)",
          color: "white",
        }}
      >
        <Square size={16} aria-hidden /> Stop &amp; save
      </button>
    </div>
  );
}
