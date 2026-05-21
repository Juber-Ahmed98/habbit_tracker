"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { previewFitImport, type FitImportPreview } from "@/lib/fit/import";
import { type FitImportSummary } from "@/lib/stores/fitness";
import { FitImportSheet } from "./FitImportSheet";

// §11 Fitness sources — FIT file sub-card. Hidden file input, big "Import"
// button, post-import status banner. Parsing happens here; the preview sheet
// shows the candidates and handles conflict resolution.

type Banner =
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string }
  | null;

function summarise(s: FitImportSummary): string {
  const parts: string[] = [];
  if (s.inserted > 0) parts.push(`${s.inserted} imported`);
  if (s.replaced > 0) parts.push(`${s.replaced} replaced`);
  if (s.merged > 0) parts.push(`${s.merged} merged`);
  if (s.skipped > 0) parts.push(`${s.skipped} skipped`);
  return parts.length === 0 ? "Nothing to import." : parts.join(", ") + ".";
}

export function FitSourceCard() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<FitImportPreview | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  async function handleFile(file: File) {
    setParsing(true);
    setBanner(null);
    try {
      const next = await previewFitImport(file);
      if (next.candidates.length === 0) {
        setBanner({
          kind: "error",
          text: "No sessions found in that file.",
        });
        return;
      }
      setPreview(next);
    } catch (err) {
      setBanner({
        kind: "error",
        text:
          err instanceof Error
            ? `Couldn't read FIT file: ${err.message}`
            : "Couldn't read FIT file.",
      });
    } finally {
      setParsing(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear the input value so the same file can be re-picked after dismiss.
    e.target.value = "";
    if (!file) return;
    void handleFile(file);
  }

  return (
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
        Fitness sources · FIT file
      </p>

      {banner ? (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-alt)",
            color:
              banner.kind === "error" ? "var(--danger)" : "var(--success)",
            border: `1px solid ${
              banner.kind === "error" ? "var(--danger)" : "var(--success)"
            }`,
          }}
        >
          {banner.text}
        </div>
      ) : null}

      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        Import a .FIT export from Garmin Connect for workouts that didn&apos;t
        sync through Strava, or to enrich an existing row with the watch&apos;s
        per-second HR data.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".fit,.FIT,application/vnd.ant.fit"
        className="hidden"
        onChange={onPick}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={parsing}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
      >
        <FileUp size={14} aria-hidden />
        {parsing ? "Reading…" : "Import .FIT file"}
      </button>

      {preview ? (
        <FitImportSheet
          preview={preview}
          onClose={() => setPreview(null)}
          onCommitted={(summary) => {
            setPreview(null);
            setBanner({ kind: "ok", text: summarise(summary) });
          }}
        />
      ) : null}
    </section>
  );
}
