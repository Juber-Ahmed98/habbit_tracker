import { type ReactNode } from "react";
import { HabitIcon } from "@/components/habits/icons";

// A titled section used inside each tab. Title + optional icon + a stack
// of children. Keeps tab pages declarative.
export function Section({
  title,
  icon,
  description,
  action,
  children,
}: {
  title: string;
  icon?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                backgroundColor: "var(--surface-alt)",
                color: "var(--text-muted)",
              }}
            >
              <HabitIcon name={icon} size={16} />
            </span>
          ) : null}
          <div>
            <h2 className="text-[16px] font-semibold leading-tight">{title}</h2>
            {description ? (
              <p
                className="text-xs leading-tight"
                style={{ color: "var(--text-muted)" }}
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
