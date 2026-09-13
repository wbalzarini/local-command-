"use client";

import { ArrowRight } from "lucide-react";
import { DashboardCard, StateBlock } from "@/components/ui/primitives";
import { useSettings } from "@/lib/settings/store";
import { formatDelta, formatDistance } from "@/lib/format";
import type { CommuteData, Route } from "@/lib/routing/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Route comparison and the switch recommendation.
 *
 * All available routes are always listed, even when the primary wins, because
 * "the alternates are worse today" is itself the answer to "is there a faster
 * way". The recommendation only appears once an alternate beats the primary by
 * more than the configured threshold — below that the difference is inside the
 * estimate's own error and switching is churn.
 */
export function RouteComparison({
  commute,
  selectedId,
  onSelect,
}: {
  commute: ModuleSnapshot<CommuteData>;
  selectedId?: string | null;
  onSelect?: (routeId: string) => void;
}) {
  const { settings } = useSettings();
  const data = commute.data;

  if (!data || !data.routes.length) {
    return (
      <DashboardCard title="Routes" status={commute.status} id="routes">
        <StateBlock
          state={commute.status.state === "ok" ? "unavailable" : commute.status.state}
          message={commute.status.message}
          lastSuccessAt={commute.status.lastSuccessAt}
          label="Route"
        />
      </DashboardCard>
    );
  }

  const fastest = Math.min(...data.routes.map((route) => route.durationMinutes));

  return (
    <DashboardCard
      title="Alternate Routes"
      subtitle={`Recommendation threshold: ${settings.alternateThresholdMinutes} min`}
      status={commute.status}
      sources={commute.sources}
      id="routes"
    >
      <ul className="space-y-2">
        {data.routes.map((route) => (
          <RouteRow
            key={route.id}
            route={route}
            isFastest={route.durationMinutes === fastest}
            recommended={data.recommendation?.routeId === route.id}
            selected={selectedId === route.id}
            onSelect={onSelect}
            units={settings.units}
          />
        ))}
      </ul>

      {data.recommendation ? (
        <div className="mt-3 flex items-start gap-2 border border-level-good-dim bg-level-good-dim/20 px-2.5 py-2">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-level-good" aria-hidden="true" />
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-level-good uppercase">
              Take {data.recommendation.label}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">
              {data.recommendation.reason}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] leading-snug text-faint">
          {data.routes.length > 1
            ? `No alternate is more than ${settings.alternateThresholdMinutes} minutes faster, so the primary route stands.`
            : "Only one route was returned for this trip."}
        </p>
      )}
    </DashboardCard>
  );
}

function RouteRow({
  route,
  isFastest,
  recommended,
  selected,
  onSelect,
  units,
}: {
  route: Route;
  isFastest: boolean;
  recommended: boolean;
  selected: boolean;
  onSelect?: (routeId: string) => void;
  units: ReturnType<typeof useSettings>["settings"]["units"];
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-fg uppercase">
            {route.label}
          </span>
          {recommended ? (
            <span className="text-[9px] font-semibold tracking-[0.12em] text-level-good uppercase">
              recommended
            </span>
          ) : isFastest ? (
            <span className="text-[9px] font-semibold tracking-[0.12em] text-faint uppercase">
              fastest
            </span>
          ) : null}
        </span>

        <span className="tnum shrink-0 font-mono text-[17px] text-fg">
          {Math.round(route.durationMinutes)}
          <span className="ml-1 text-[10px] text-faint">min</span>
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted">{route.summary}</span>
        <span className="tnum shrink-0 font-mono text-[11px]">
          <span
            className={
              route.delayMinutes === null
                ? "text-level-unknown"
                : route.delayMinutes >= 10
                  ? "text-level-poor"
                  : route.delayMinutes >= 3
                    ? "text-level-moderate"
                    : "text-level-good"
            }
          >
            {route.delayMinutes === null ? "no traffic data" : formatDelta(route.delayMinutes)}
          </span>
          <span className="mx-1.5 text-line-strong">·</span>
          <span className="text-faint">{formatDistance(route.distanceMiles, units)}</span>
        </span>
      </div>
    </>
  );

  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(route.id)}
          aria-pressed={selected}
          className={`w-full border px-2.5 py-2 text-left transition-colors ${
            selected
              ? "border-line-strong bg-raised"
              : "hairline border-line hover:bg-raised/40"
          }`}
        >
          {body}
        </button>
      ) : (
        <div
          className={`border px-2.5 py-2 ${
            route.isPrimary ? "border-line-strong bg-raised/40" : "hairline border-line"
          }`}
        >
          {body}
        </div>
      )}
    </li>
  );
}
