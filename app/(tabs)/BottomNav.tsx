"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Briefcase,
  Moon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useSettingsStore } from "@/lib/stores/settings";
import { type TabKey } from "@/lib/db/schema";

type Tab = {
  key: TabKey;
  href: string;
  label: string;
  Icon: LucideIcon;
};

// Spec §5: five tabs, fixed bottom. Order matches §5.1–§5.5.
// Onboarding (§10) lets the user untick non-dashboard tabs; we filter here.
const TABS: Tab[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "fitness", href: "/fitness", label: "Fitness", Icon: Dumbbell },
  { key: "work", href: "/work", label: "Work", Icon: Briefcase },
  { key: "deen", href: "/deen", label: "Deen", Icon: Moon },
  { key: "lifestyle", href: "/lifestyle", label: "Lifestyle", Icon: Sparkles },
];

export default function BottomNav() {
  const pathname = usePathname();
  const enabledTabs = useSettingsStore((s) => s.settings.enabledTabs);
  const visible = TABS.filter((t) => enabledTabs[t.key] ?? true);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-14 max-w-md items-stretch">
        {visible.map(({ href, label, Icon }) => {
          // Active when on the tab itself or any nested route under it.
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5"
                style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}
              >
                <Icon size={22} strokeWidth={2} aria-hidden />
                {/* Spec: active tab shows icon + label; inactive shows icon only. */}
                {isActive ? (
                  <span className="text-[11px] font-medium leading-none">
                    {label}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
