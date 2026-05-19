"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { type Habit } from "@/lib/db/schema";
import { useHabitsStore } from "@/lib/stores/habits";

const editSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  timeOfDay: z
    .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM")])
    .optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

export function EditHabitSheet() {
  const editingId = useHabitsStore((s) => s.editingHabitId);
  const setEditingId = useHabitsStore((s) => s.setEditingHabitId);

  const habit = useLiveQuery(
    () => (editingId ? getDb().habits.get(editingId) : undefined),
    [editingId],
  );

  const open = !!editingId;
  const close = () => setEditingId(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-root"
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
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Edit habit"
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
              <h2 className="text-[20px] font-semibold">Edit habit</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-2 p-2"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {habit ? (
              // Keyed by id so transient local state (confirmingDelete)
              // resets cleanly when the user opens a different habit.
              <EditHabitForm key={habit.id} habit={habit} onDone={close} />
            ) : (
              <p
                className="px-4 py-6 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Loading…
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditHabitForm({
  habit,
  onDone,
}: {
  habit: Habit;
  onDone: () => void;
}) {
  const updateHabit = useHabitsStore((s) => s.updateHabit);
  const deleteHabit = useHabitsStore((s) => s.deleteHabit);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: habit.name,
      timeOfDay: habit.schedule.timeOfDay ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await updateHabit(habit.id, {
      name: values.name.trim(),
      schedule: {
        ...habit.schedule,
        timeOfDay: values.timeOfDay ? values.timeOfDay : undefined,
      },
    });
    onDone();
  });

  const onDelete = async () => {
    await deleteHabit(habit.id);
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-4 pt-4">
      <div>
        <label htmlFor="habit-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="habit-name"
          {...register("name")}
          className="w-full rounded-xl px-3 py-2 text-base outline-none"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        />
        {errors.name && (
          <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
            {errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="habit-time" className="mb-1 block text-sm font-medium">
          Reminder time
        </label>
        <input
          id="habit-time"
          type="time"
          {...register("timeOfDay")}
          className="w-full rounded-xl px-3 py-2 text-base outline-none"
          style={{
            backgroundColor: "var(--surface-alt)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        />
        {errors.timeOfDay && (
          <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
            {errors.timeOfDay.message}
          </p>
        )}
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Reminders fire when notifications land in Step 5.
        </p>
      </div>

      <div
        className="rounded-xl px-3 py-2 text-xs"
        style={{
          backgroundColor: "var(--surface-alt)",
          color: "var(--text-muted)",
        }}
      >
        Streak history view comes in Step 4.
      </div>

      <div className="flex items-center justify-between pt-2">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ color: "var(--danger)" }}
          >
            <Trash2 size={16} /> Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--danger)",
                color: "white",
              }}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-xl px-3 py-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-ink)",
          }}
        >
          Save
        </button>
      </div>
    </form>
  );
}
