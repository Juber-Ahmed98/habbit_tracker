import type { ReactNode } from "react";
import { EditHabitSheet } from "@/components/habits/EditHabitSheet";
import BottomNav from "./BottomNav";
import { TabGuard } from "./TabGuard";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TabGuard />
      <main
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{
          paddingBottom:
            "calc(56px + env(safe-area-inset-bottom) + 16px)",
        }}
      >
        {children}
      </main>
      <BottomNav />
      <EditHabitSheet />
    </div>
  );
}
