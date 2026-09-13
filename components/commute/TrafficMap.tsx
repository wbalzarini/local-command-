"use client";

import { useCallback, useState } from "react";
import { MapCanvas, type MapReady } from "@/components/ui/MapCanvas";
import { DashboardCard, StateBlock } from "@/components/ui/primitives";
import { PasscodeGate } from "./PasscodeGate";
import { formatTime } from "@/lib/format";
import type { CommuteData, RouteIncident } from "@/lib/routing/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The commute map.
 *
 * The primary route is drawn bright and the alternates dim, so the choice
 * reads at a glance. Incidents are markers that open with what the reporting
 * agency actually said — location, report time, stated delay and the source —
 * and nothing beyond that: an incident with no stated delay shows "not
 * stated", never an estimate of this app's own invention.
 *
 * Only rendered once the passcode gate is open, since the route drawn here
 * starts at the user's house.
 */
export function TrafficMap({
  commute,
  onUnlocked,
  height = 320,
}: {
  commute: ModuleSnapshot<CommuteData>;
  onUnlocked: () => void;
  height?: number;
}) {
  const [selected, setSelected] = useState<RouteIncident | null>(null);
  const data = commute.data;

  const onReady = useCallback(
    ({ L, map }: MapReady) => {
      if (!data) return;

      const bounds: [number, number][] = [];

      // Alternates first so the primary is drawn on top of them.
      for (const route of [...data.routes].reverse()) {
        if (!route.geometry?.length) continue;
        bounds.push(...route.geometry);

        L.polyline(route.geometry, {
          color: route.isPrimary ? "var(--color-info)" : "var(--color-muted)",
          weight: route.isPrimary ? 4 : 2.5,
          opacity: route.isPrimary ? 0.95 : 0.5,
          dashArray: route.isPrimary ? undefined : "6 5",
        })
          .addTo(map)
          .bindTooltip(`${route.label} · ${Math.round(route.durationMinutes)} min`);
      }

      for (const route of data.routes) {
        for (const incident of route.incidents) {
          if (!incident.coordinates) continue;
          L.circleMarker([incident.coordinates.lat, incident.coordinates.lon], {
            radius: 6,
            color:
              incident.type === "closure"
                ? "var(--color-level-severe)"
                : incident.type === "accident"
                  ? "var(--color-level-poor)"
                  : "var(--color-level-moderate)",
            weight: 2,
            fillOpacity: 0.85,
          })
            .addTo(map)
            .on("click", () => setSelected(incident));
        }
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [18, 18] });
      }
    },
    [data],
  );

  if (commute.status.state === "locked") {
    return (
      <DashboardCard title="Commute Map" status={commute.status}>
        <PasscodeGate
          onUnlocked={onUnlocked}
          kind={commute.status.lockKind ?? "passcode"}
          message={commute.status.message}
        />
      </DashboardCard>
    );
  }

  if (!data?.routes.length) {
    return (
      <DashboardCard title="Commute Map" status={commute.status}>
        <StateBlock
          state={commute.status.state === "ok" ? "unavailable" : commute.status.state}
          message={commute.status.message}
          lastSuccessAt={commute.status.lastSuccessAt}
          label="Commute map"
        />
      </DashboardCard>
    );
  }

  const drawable = data.routes.filter((route) => route.geometry?.length);
  const centre = drawable[0]?.geometry?.[Math.floor((drawable[0].geometry?.length ?? 0) / 2)];

  return (
    <DashboardCard
      title="Commute Intelligence"
      subtitle={`${data.routes.length} ${data.routes.length === 1 ? "route" : "routes"} · ${data.provider.name}`}
      status={commute.status}
      sources={commute.sources}
    >
      {drawable.length && centre ? (
        <MapCanvas
          center={centre}
          zoom={10}
          height={height}
          onReady={onReady}
          ariaLabel="Commute route map with traffic incidents"
          className="border hairline border-line"
        />
      ) : (
        <p className="border hairline border-line px-3 py-8 text-center text-[12px] text-faint">
          This routing provider did not return route geometry, so the map cannot
          be drawn. Timings and the route comparison are unaffected.
        </p>
      )}

      {selected ? (
        <div className="mt-3 border border-level-moderate-dim bg-level-moderate-dim/20 px-2.5 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[12px] font-semibold tracking-[0.1em] text-level-moderate uppercase">
              {selected.type.replace("-", " ")}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[10px] tracking-wide text-faint uppercase hover:text-muted"
            >
              Close
            </button>
          </div>

          <dl className="mt-1.5 space-y-1 text-[11px]">
            <Detail label="Location" value={selected.location ?? "not stated"} />
            <Detail
              label="Reported"
              value={selected.reportedAt ? formatTime(selected.reportedAt) : "not stated"}
            />
            <Detail
              label="Estimated delay"
              value={
                selected.delayMinutes === null || selected.delayMinutes === undefined
                  ? "not stated by source"
                  : `+${Math.round(selected.delayMinutes)} min`
              }
            />
            <Detail label="Source" value={selected.source.name} url={selected.source.url} />
          </dl>

          <p className="mt-1.5 text-[11px] leading-snug text-muted">{selected.description}</p>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-faint">
          Solid line: primary route. Dashed: alternates. Tap a marker for incident detail.
        </p>
      )}
    </DashboardCard>
  );
}

function Detail({
  label,
  value,
  url,
}: {
  label: string;
  value: string;
  url?: string;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 tracking-wide text-faint uppercase">{label}</dt>
      <dd className="min-w-0 flex-1 text-fg">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline decoration-line underline-offset-2"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
