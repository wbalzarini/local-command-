"use client";

import { useEffect, useState } from "react";
import { formatLongDay, formatTime, TIME_ZONE } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";
import type { DayStatus } from "@/types";

/**
 * The header: where you are, when it is, and how the day scores.
 *
 * The clock ticks client-side and renders blank until mounted. Server-rendering
 * a wall clock guarantees a hydration mismatch — the server's second is never
 * the browser's — and a flash of the wrong time on a dashboard whose whole
 * point is "right now" is worse than a moment without one.
 */
export function CommandHeader({
  dayStatus,
  location,
  liveState,
}: {
  dayStatus?: DayStatus;
  location: string;
  /** Drives the pulse next to the clock: green live, amber degraded. */
  liveState: "live" | "degraded" | "offline";
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const dot =
    liveState === "live"
      ? "bg-level-good"
      : liveState === "degraded"
        ? "bg-level-moderate"
        : "bg-level-severe";

  return (
    <header className="gridlines border-b hairline border-line bg-surface/50">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[13px] font-semibold tracking-[0.2em] text-fg uppercase">
              Command Center
            </h1>
            <span
              className={`size-1.5 rounded-full ${dot} ${
                liveState === "live" ? "animate-pulse-ring" : ""
              }`}
              aria-hidden="true"
            />
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {now === null ? " " : formatLongDay(now)}
            <span className="mx-2 text-line-strong">/</span>
            <span className="text-faint">{location}</span>
          </p>
        </div>

        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="micro">Local</div>
            <div className="tnum mt-1 font-mono text-2xl leading-none text-fg">
              {now === null ? "--:--" : formatTime(now)}
            </div>
            <div className="mt-1 text-[10px] text-faint">
              {TIME_ZONE.split("/")[1].replace("_", " ")}
            </div>
          </div>

          {dayStatus ? (
            <div className="text-right">
              <div className="micro">Day Status</div>
              <div className="mt-1">
                <StatusBadge level={dayStatus.level} label={dayStatus.label} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
