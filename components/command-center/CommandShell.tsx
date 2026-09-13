import type { ReactNode } from "react";
import { BottomNav, SideNav } from "./Nav";

/**
 * The Command Center frame: a nav rail beside one scrolling column.
 *
 * On a phone the rail becomes the bar at the bottom, which is the only
 * placement that works one-handed. The content column is capped at a
 * comfortable measure rather than filling a wide monitor — dense tabular data
 * in metre-wide rows is unreadable, and the extra width buys nothing.
 */
export function CommandShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-ink">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1100px]">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
