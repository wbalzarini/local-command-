"use client";

import { DashboardCard, Row, StateBlock } from "@/components/ui/primitives";
import { formatTime } from "@/lib/format";
import type { CommuteData } from "@/lib/routing/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The recommended departure time, with its arithmetic on display.
 *
 * Drive time, traffic buffer and weather buffer are listed separately and sum
 * to the total, so the recommendation is checkable. A dashboard that says
 * "leave at 7:08" without saying why is asking to be trusted; one that shows
 * 34 + 6 + 3 is asking to be read.
 */
export function DepartureCard({
  commute,
  compact = false,
}: {
  commute: ModuleSnapshot<CommuteData>;
  compact?: boolean;
}) {
  const data = commute.data;
  const departure = data?.departure;

  if (!departure) {
    return (
      <DashboardCard title="Recommended Departure" status={commute.status}>
        <StateBlock
          state={commute.status.state === "ok" ? "unavailable" : commute.status.state}
          message={
            commute.status.state === "locked"
              ? undefined
              : "A departure time needs a route and an arrival time. Set your arrival time in Settings."
          }
          lastSuccessAt={commute.status.lastSuccessAt}
          label="Departure"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Recommended Departure"
      subtitle={`For a ${departure.arrivalTarget} arrival`}
      status={commute.status}
      sources={commute.sources}
      right={
        departure.overdue ? (
          <span className="text-[10px] font-semibold tracking-[0.1em] text-level-poor uppercase">
            Past
          </span>
        ) : null
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div
            className={`tnum font-mono text-4xl leading-none ${
              departure.overdue ? "text-level-poor" : "text-fg"
            }`}
          >
            {formatTime(departure.departAt)}
          </div>
          <div className="mt-1.5 text-[12px] text-muted">
            {departure.totalMinutes} min door to door
          </div>
        </div>

        <div className="text-right">
          <div className="micro">Arrive</div>
          <div className="tnum mt-1 font-mono text-[15px] text-fg">
            {formatTime(departure.arrivalAt)}
          </div>
        </div>
      </div>

      {!compact ? (
        <dl className="mt-3">
          <Row label="Drive" value={`${departure.driveMinutes} min`} />
          <Row
            label="Traffic buffer"
            value={
              data?.trafficAware
                ? `${departure.trafficBufferMinutes} min`
                : "not available"
            }
            tone={data?.trafficAware ? undefined : "unknown"}
          />
          <Row label="Weather buffer" value={`${departure.weatherBufferMinutes} min`} />
          <Row label="Total" value={`${departure.totalMinutes} min`} />
        </dl>
      ) : null}

      {departure.overdue ? (
        <p className="mt-3 border-l-2 border-level-poor pl-2 text-[11px] leading-snug text-level-poor">
          This departure time has passed. Leaving now arrives around{" "}
          {formatTime(Date.now() + departure.totalMinutes * 60_000)}.
        </p>
      ) : null}
    </DashboardCard>
  );
}
