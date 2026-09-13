"use client";

import { DashboardCard, Row, StateBlock, StatusBadge } from "@/components/ui/primitives";
import { useSettings } from "@/lib/settings/store";
import { formatDelta, formatPercent, formatWind } from "@/lib/format";
import type { CommuteData } from "@/lib/routing/types";
import type { ModuleSnapshot, StatusLevel } from "@/types";

/**
 * Weather and traffic, combined into one read on the drive.
 *
 * This is where the two modules actually meet: the weather used here is the
 * forecast for the hour of the drive, not the conditions outside now, which is
 * the difference that matters when the drive is two hours away. The factors
 * that contributed are listed, so a three-minute buffer is traceable to the
 * rain probability that produced it.
 */

const RISK_LEVEL: Record<CommuteData["impact"]["roadRisk"], StatusLevel> = {
  low: "good",
  moderate: "moderate",
  high: "poor",
};

export function CommuteImpact({ commute }: { commute: ModuleSnapshot<CommuteData> }) {
  const { settings } = useSettings();
  const data = commute.data;

  if (!data) {
    return (
      <DashboardCard title="Commute Impact" status={commute.status}>
        <StateBlock
          state={commute.status.state === "ok" ? "unavailable" : commute.status.state}
          message={commute.status.message}
          lastSuccessAt={commute.status.lastSuccessAt}
          label="Commute impact"
        />
      </DashboardCard>
    );
  }

  const { impact } = data;

  return (
    <DashboardCard
      title="Commute Impact"
      right={<StatusBadge level={RISK_LEVEL[impact.roadRisk]} label={`${impact.roadRisk} risk`} size="sm" />}
      status={commute.status}
      sources={commute.sources}
    >
      <dl>
        <Row
          label="Traffic"
          value={impact.trafficMinutes === null ? "no traffic data" : formatDelta(impact.trafficMinutes)}
          tone={impact.trafficMinutes === null ? "unknown" : undefined}
        />
        <Row label="Rain probability" value={formatPercent(impact.precipProbability)} />
        <Row
          label="Visibility"
          value={impact.visibilityMiles === null ? "—" : `${impact.visibilityMiles.toFixed(1)} mi`}
        />
        <Row label="Wind gusts" value={formatWind(impact.windGust, settings.units)} />
        <Row
          label="Road risk"
          value={impact.roadRisk.toUpperCase()}
          tone={RISK_LEVEL[impact.roadRisk]}
        />
        <Row label="Weather buffer" value={`${impact.weatherBufferMinutes} min`} />
      </dl>

      {impact.factors.length ? (
        <ul className="mt-3 space-y-1">
          {impact.factors.map((factor) => (
            <li key={factor} className="flex gap-2 text-[11px] leading-snug text-muted">
              <span className="text-line-strong" aria-hidden="true">
                ·
              </span>
              {factor}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 border-l-2 border-line-strong pl-2 text-[12px] leading-snug text-fg">
        {impact.recommendation}
      </p>

      <p className="mt-2 text-[10px] leading-snug text-faint">
        Weather buffer = risk factors × {settings.weatherBufferMinutes} min, the value set
        in Settings, capped at 15 minutes.
      </p>
    </DashboardCard>
  );
}
