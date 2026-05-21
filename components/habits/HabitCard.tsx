"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { Check } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { getDb } from "@/lib/db";
import { type Habit } from "@/lib/db/schema";
import {
  HAPTIC_LONG_PRESS,
  HAPTIC_MILESTONE,
  HAPTIC_TAP,
  vibrate,
} from "@/lib/haptics";
import { useHabitsStore } from "@/lib/stores/habits";
import { toLocalDateString } from "@/lib/utils/date";
import { HabitIcon } from "./icons";
import { StreakFlame } from "./StreakFlame";

type Props = {
  habit: Habit;
};

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

export function HabitCard({ habit }: Props) {
  const today = useMemo(() => toLocalDateString(), []);

  const completion = useLiveQuery(
    () =>
      getDb()
        .completions.where("[habitId+date]")
        .equals([habit.id, today])
        .first(),
    [habit.id, today],
  );
  const completed = !!completion;

  const snapshot = useLiveQuery(
    () => getDb().streakSnapshots.get(habit.id),
    [habit.id],
  );
  const streak = snapshot?.current ?? 0;

  const toggleHabit = useHabitsStore((s) => s.toggleHabit);
  const setEditingId = useHabitsStore((s) => s.setEditingHabitId);

  const reduceMotion = useReducedMotion();

  // Tap origin (as a percentage of the card box) for the radial reveal.
  // Defaults to centre so keyboard activation still produces a sensible reveal.
  const [tapOrigin, setTapOrigin] = useState({ x: 50, y: 50 });

  const cardRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const downPoint = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    longPressFired.current = false;
    downPoint.current = { x: e.clientX, y: e.clientY };
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setTapOrigin({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    }
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      vibrate(HAPTIC_LONG_PRESS);
      setEditingId(habit.id);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!downPoint.current) return;
    const dx = e.clientX - downPoint.current.x;
    const dy = e.clientY - downPoint.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearLongPress();
      // Mark as fired so the upcoming click doesn't tick — the user is
      // scrolling/dragging, not tapping.
      longPressFired.current = true;
    }
  };

  const handlePointerEnd = () => {
    clearLongPress();
    downPoint.current = null;
  };

  const handleClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    // Fire the tap haptic optimistically — the toggle write is async and we
    // don't want a perceptible delay between press and buzz. If the tick
    // crossed a streak milestone, follow up with the double-tap pattern.
    vibrate(HAPTIC_TAP);
    void toggleHabit(habit.id).then((result) => {
      if (result.crossedMilestone !== null) {
        vibrate(HAPTIC_MILESTONE);
      }
    });
  };

  // Radial-fill clip path. Reduced motion: snap to fully filled (or empty).
  const clipPath = completed
    ? `circle(160% at ${tapOrigin.x}% ${tapOrigin.y}%)`
    : `circle(0% at ${tapOrigin.x}% ${tapOrigin.y}%)`;

  return (
    <button
      ref={cardRef}
      type="button"
      aria-pressed={completed}
      aria-label={`${habit.name}${completed ? ", completed" : ""}${streak >= 3 ? `, ${streak} day streak` : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
      className="relative w-full overflow-hidden rounded-card text-left select-none"
      style={{
        padding: "16px",
        minHeight: 64,
        border: completed
          ? "2px solid var(--accent)"
          : "2px dashed var(--neutral-outline)",
        color: completed ? "var(--accent-ink)" : "var(--text-muted)",
        backgroundColor: "transparent",
        transition:
          "border-color 150ms ease-out, color 150ms ease-out, background-color 150ms ease-out",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {/* Radial accent fill. Sits behind content; clip-path drives the reveal. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: "var(--accent)" }}
        initial={false}
        animate={{ clipPath }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
        }
      />

      <div className="relative flex items-center gap-3">
        <HabitIcon name={habit.icon} size={20} strokeWidth={2} aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="truncate text-base font-medium"
            style={{
              color: completed ? "var(--accent-ink)" : "var(--text)",
              transition: "color 150ms ease-out",
            }}
          >
            {habit.name}
          </span>
          <StreakFlame streak={streak} />
        </div>

        <AnimatePresence initial={false}>
          {completed && (
            <motion.span
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 400, damping: 18 }
              }
              className="inline-flex"
              aria-hidden
            >
              <Check size={20} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}
