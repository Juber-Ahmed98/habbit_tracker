"use client";

import { Flame } from "lucide-react";

type Props = {
  streak: number;
  className?: string;
};

// §4 Streak flame: pulse at 3+, filled at 7+, subtle glow at 30+.
// Pulse comes from a CSS keyframe so prefers-reduced-motion (handled in
// globals.css) cancels it automatically.
export function StreakFlame({ streak, className = "" }: Props) {
  if (streak < 3) return null;
  const filled = streak >= 7;
  const glow = streak >= 30;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
      style={{ color: "var(--streak)" }}
      aria-label={`Current streak: ${streak} days`}
    >
      <Flame
        size={14}
        strokeWidth={2}
        fill={filled ? "currentColor" : "none"}
        className="habit-flame"
        style={
          glow
            ? { filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--streak) 60%, transparent))" }
            : undefined
        }
      />
      <span>{streak}</span>
    </span>
  );
}
