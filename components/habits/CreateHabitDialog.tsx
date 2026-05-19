"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type HabitTab } from "@/lib/db/schema";
import { useHabitsStore } from "@/lib/stores/habits";
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_CHOICES,
  HabitIcon,
} from "./icons";

const HABIT_TABS: HabitTab[] = ["fitness", "work", "deen", "lifestyle"];

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  tab: z.enum(["fitness", "work", "deen", "lifestyle"]),
  icon: z.string().min(1),
});

type CreateFormValues = z.infer<typeof createSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateHabitDialog({ open, onClose }: Props) {
  const createHabit = useHabitsStore((s) => s.createHabit);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", tab: "lifestyle", icon: DEFAULT_HABIT_ICON },
  });

  const selectedIcon = watch("icon");

  const onSubmit = handleSubmit(async (values) => {
    await createHabit({
      tab: values.tab,
      name: values.name.trim(),
      icon: values.icon,
      type: "toggle",
    });
    reset({ name: "", tab: values.tab, icon: DEFAULT_HABIT_ICON });
    onClose();
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="create-root"
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create habit"
            className="relative w-full max-w-md"
            style={{
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-[20px] font-semibold">New habit</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 p-2"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 px-4 pt-4">
              <div>
                <label
                  htmlFor="new-habit-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Name
                </label>
                <input
                  id="new-habit-name"
                  {...register("name")}
                  placeholder="e.g. Drink water"
                  className="w-full rounded-xl px-3 py-2 text-base outline-none"
                  style={{
                    backgroundColor: "var(--surface-alt)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                  autoFocus
                />
                {errors.name && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--danger)" }}
                  >
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="new-habit-tab"
                  className="mb-1 block text-sm font-medium"
                >
                  Tab
                </label>
                <select
                  id="new-habit-tab"
                  {...register("tab")}
                  className="w-full rounded-xl px-3 py-2 text-base outline-none capitalize"
                  style={{
                    backgroundColor: "var(--surface-alt)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {HABIT_TABS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium">Icon</span>
                <div className="grid grid-cols-7 gap-2">
                  {HABIT_ICON_CHOICES.map((name) => {
                    const active = selectedIcon === name;
                    return (
                      <button
                        type="button"
                        key={name}
                        onClick={() => setValue("icon", name)}
                        aria-label={name}
                        aria-pressed={active}
                        className="flex h-10 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: active
                            ? "var(--accent)"
                            : "var(--surface-alt)",
                          color: active ? "var(--accent-ink)" : "var(--text)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <HabitIcon name={name} size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
