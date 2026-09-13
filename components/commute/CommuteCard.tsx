"use client";

import { DashboardCard, Row, StateBlock, StatusBadge } from "@/components/ui/primitives";
import { PasscodeGate } from "./PasscodeGate";
import { useSettings } from "@/lib/settings/store";
import { formatDelta, formatDistance, formatMinutes } from "@/lib/format";
import type { CommuteData } from "@/lib/routing/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The commute headline: normal, current, delay, status.
 *
 * When no traffic-aware provider is configured the delay row says so rather
 * than showing "+0 min". A router without live speeds has no opinion about
 * traffic, and printing a zero would turn the absence of data into a claim
 * that the roads are clear.
 */
export function CommuteCard({
  commute,
  onUnlocked,
  compact = false,
}: {
  commute: ModuleSnapshot<CommuteData>;
  onUnlocked: () => void;
  compact?: boolean;
}) {
  const { settings } = useSettings();
  const data = commute.data;

  if (commute.status.state === "locked") {
    return (
      <DashboardCard title="Commute" status={commute.status}>
        <PasscodeGate
          onUnlocked={onUnlocked}
          kind={commute.status.lockKind ?? "passcode"}
          message={commute.status.message}
        />
      </DashboardCard>
    );
  }

  if (!data || !data.primary) {
    return (
      <DashboardCard title="Commute" status={commute.status} sources={commute.sources}>
        <StateBlock
          state={commute.status.state === "ok" ? "unavailable" : commute.status.state}
          message={commute.status.message}
          lastSuccessAt={commute.status.lastSuccessAt}
          label="Traffic"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Today's Commute"
      subtitle={`${data.origin.label} → ${data.destination.label}`}
      right={
        <StatusBadge
          level={data.level}
          label={data.trafficAware ? undefined : "NO TRAFFIC DATA"}
          size="sm"
        />
      }
      status={commute.status}
      sources={commute.sources}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="micro">Current</div>
          <div className="tnum mt-1 font-mono text-4xl leading-none text-fg">
            {Math.round(data.currentMinutes ?? 0)}
            <span className="ml-1 text-base text-faint">min</span>
          </div>
        </div>

        <div className="text-right">
          <div className="micro">Delay</div>
          <div
            className={`tnum mt-1 font-mono text-xl leading-none ${
              data.delayMinutes === null
                ? "text-level-unknown"
                : data.delayMinutes >= settings.trafficThresholdMinutes
                  ? "text-level-poor"
                  : data.delayMinutes >= 3
                    ? "text-level-moderate"
                    : "text-level-good"
            }`}
          >
            {data.delayMinutes === null ? "n/a" : formatDelta(data.delayMinutes)}
          </div>
        </div>
      </div>

      {!compact ? (
        <dl className="mt-3">
          <Row label="Normal" value={formatMinutes(data.normalMinutes)} />
          <Row label="Distance" value={formatDistance(data.primary.distanceMiles, settings.units)} />
          <Row label="Route" value={data.primary.summary} />
          <Row
            label="Traffic model"
            value={data.trafficAware ? "Live traffic" : "Free-flow only"}
            tone={data.trafficAware ? "good" : "unknown"}
          />
          <Row
            label="Incidents on route"
            value={
              data.primary.incidents.length
                ? String(data.primary.incidents.length)
                : "None reported"
            }
          />
        </dl>
      ) : (
        <p className="mt-2 text-[11px] text-faint">
          Normal {formatMinutes(data.normalMinutes)} · {data.primary.summary}
        </p>
      )}

      {!data.trafficAware ? (
        <p className="mt-3 border-l-2 border-level-unknown pl-2 text-[11px] leading-snug text-faint">
          Times come from a road graph with no live traffic. Set MAPBOX_TOKEN,
          HERE_API_KEY or GOOGLE_MAPS_API_KEY for traffic-aware timings and a
          real delay figure.
        </p>
      ) : null}
    </DashboardCard>
  );
}
