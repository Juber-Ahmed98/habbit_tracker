"use client";

import { createElement } from "react";
import {
  BookOpen,
  Briefcase,
  Check,
  Circle,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Inbox,
  Leaf,
  Moon,
  Pill,
  Sparkles,
  Sun,
  Timer,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

// Curated set of icons available to habits. Keep small for now; growing
// this is cheap. The habit schema stores `icon` as a string so any rename
// here must be migrated.
export const HABIT_ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  droplet: Droplet,
  pill: Pill,
  leaf: Leaf,
  moon: Moon,
  sun: Sun,
  coffee: Coffee,
  briefcase: Briefcase,
  inbox: Inbox,
  bookOpen: BookOpen,
  timer: Timer,
  sparkles: Sparkles,
  check: Check,
};

export const DEFAULT_HABIT_ICON = "check";

export function resolveHabitIcon(name: string): LucideIcon {
  return HABIT_ICONS[name] ?? Circle;
}

// Render-time wrapper. Uses createElement so the lint's "static components"
// check is satisfied — we're calling a function, not declaring a component.
export function HabitIcon({
  name,
  ...props
}: LucideProps & { name: string }) {
  return createElement(resolveHabitIcon(name), props);
}

export const HABIT_ICON_CHOICES = Object.keys(HABIT_ICONS);
