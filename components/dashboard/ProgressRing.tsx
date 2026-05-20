"use client";

import { motion, useReducedMotion } from "framer-motion";

// 160px ring, 12px stroke per §5.1. Stroke transitions from neutral-outline
// → accent as the dasharray fills.
const SIZE = 160;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function ProgressRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const reduceMotion = useReducedMotion();
  const safeTotal = Math.max(total, 0);
  const ratio = safeTotal === 0 ? 0 : Math.min(completed / safeTotal, 1);
  const dashOffset = CIRC * (1 - ratio);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Daily progress, ${completed} of ${safeTotal} habits`}
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--neutral-outline)"
          strokeOpacity={0.25}
          strokeWidth={STROKE}
        />
        {/* Fill */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
          }
          // Start the arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold leading-none">
          {completed}
          <span style={{ color: "var(--text-muted)" }}> / {safeTotal}</span>
        </span>
        <span
          className="mt-1 text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Done today
        </span>
      </div>
    </div>
  );
}
