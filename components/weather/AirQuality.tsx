"use client";

import { DashboardCard, Row, StateBlock, StatusBadge } from "@/components/ui/primitives";
import type { AirQualityData } from "@/lib/weather/types";
import type { ModuleSnapshot, StatusLevel } from "@/types";

/**
 * Air quality.
 *
 * The AQI band is the headline because it is the part that changes behaviour;
 * the constituent readings sit beneath it for anyone who wants them. Pollen is
 * listed even though the provider does not publish it for North America —
 * "not published for this location" is information, and an omitted row would
 * read as zero.
 */

const LEVEL: Record<AirQualityData["category"], StatusLevel> = {
  good: "good",
  moderate: "moderate",
  "unhealthy-sensitive": "poor",
  unhealthy: "poor",
  "very-unhealthy": "severe",
  hazardous: "severe",
  unknown: "unknown",
};

export function AirQuality({ air }: { air: ModuleSnapshot<AirQualityData> }) {
  const data = air.data;

  if (!data) {
    return (
      <DashboardCard title="Air Quality" status={air.status} sources={air.sources}>
        <StateBlock
          state={air.status.state === "ok" ? "unavailable" : air.status.state}
          message={air.status.message}
          lastSuccessAt={air.status.lastSuccessAt}
          label="Air quality"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Air Quality"
      right={<StatusBadge level={LEVEL[data.category]} label={data.label} size="sm" />}
      status={air.status}
      sources={air.sources}
    >
      <div className="flex items-end gap-3">
        <div className="tnum font-mono text-3xl leading-none text-fg">
          {data.aqi === null ? "—" : Math.round(data.aqi)}
        </div>
        <div className="pb-0.5 text-[11px] text-faint">US EPA AQI</div>
      </div>

      <dl className="mt-3">
        <Row label="PM2.5" value={data.pm25 === null ? "—" : `${data.pm25.toFixed(1)} µg/m³`} />
        <Row label="PM10" value={data.pm10 === null ? "—" : `${data.pm10.toFixed(1)} µg/m³`} />
        <Row label="Ozone" value={data.ozone === null ? "—" : `${data.ozone.toFixed(1)} µg/m³`} />
        <Row
          label="Smoke (AOD)"
          value={data.smokeIndex === null ? "—" : data.smokeIndex.toFixed(2)}
        />
        <Row
          label="Pollen"
          value={
            data.pollen ? "—" : <span className="text-faint">not published for this location</span>
          }
        />
      </dl>

      <p className="mt-3 text-[12px] leading-snug text-muted">{data.summary}</p>
    </DashboardCard>
  );
}
