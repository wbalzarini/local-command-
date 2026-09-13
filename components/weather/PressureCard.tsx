"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/ui/charts";
import {
  DashboardCard,
  Row,
  Segmented,
  StateBlock,
  TrendIndicator,
} from "@/components/ui/primitives";
import { useSettings } from "@/lib/settings/store";
import {
  displayPressure,
  formatHour,
  formatPressure,
  formatPressureDelta,
  formatShortDay,
  pressureDecimals,
  TREND_ARROW,
  TREND_LABEL,
} from "@/lib/format";
import type { WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Barometric pressure, treated as a first-class reading.
 *
 * Four windows are shown at once — three, six, twelve and twenty-four hours —
 * because the shape of the change carries the information: a steady
 * twelve-hour decline and a sudden three-hour drop are different situations
 * that a single arrow would render identically.
 *
 * The interpretation line talks about atmospheric stability and stops there.
 * Pressure alone does not predict a storm, and this card does not imply it
 * does.
 */

type Range = "6H" | "12H" | "24H" | "3D" | "7D";

const RANGE_HOURS: Record<Range, number> = {
  "6H": 6,
  "12H": 12,
  "24H": 24,
  "3D": 72,
  "7D": 168,
};

export function PressureCard({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const { settings } = useSettings();
  const [range, setRange] = useState<Range>("24H");
  const data = weather.data;

  const series = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - RANGE_HOURS[range] * 3_600_000;

    // History for the shorter windows; for the multi-day ranges the observed
    // record is padded with forecast pressure so the chart still has a shape,
    // drawn dashed so the two are never confused.
    const observed = data.pressure.history
      .filter((point) => point.time >= cutoff)
      .map((point) => ({ x: point.time, y: displayPressure(point.pressureInHg, settings.units) }));

    const forecast =
      RANGE_HOURS[range] > 24
        ? data.hourly
            .filter((hour) => hour.pressureInHg !== null)
            .slice(0, RANGE_HOURS[range])
            .map((hour) => ({
              x: hour.time,
              y: displayPressure(hour.pressureInHg as number, settings.units),
            }))
        : [];

    return [
      { key: "observed", points: observed, color: "var(--color-series-pressure)", fill: true },
      ...(forecast.length
        ? [
            {
              key: "forecast",
              points: forecast,
              color: "var(--color-series-pressure)",
              dashed: true,
              width: 1.25,
            },
          ]
        : []),
    ];
  }, [data, range, settings.units]);

  if (!data) {
    return (
      <DashboardCard title="Pressure" status={weather.status} sources={weather.sources}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Pressure"
        />
      </DashboardCard>
    );
  }

  const { pressure } = data;
  const hasPoints = series.some((entry) => entry.points.length > 1);
  const multiDay = RANGE_HOURS[range] > 24;

  return (
    <DashboardCard
      title="Barometric Pressure"
      right={
        <Segmented
          label="Pressure history range"
          value={range}
          onChange={setRange}
          options={[
            { value: "6H", label: "6H" },
            { value: "12H", label: "12H" },
            { value: "24H", label: "24H" },
            { value: "3D", label: "3D" },
            { value: "7D", label: "7D" },
          ]}
        />
      }
      status={weather.status}
      sources={weather.sources}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="tnum font-mono text-3xl leading-none text-fg">
            {formatPressure(pressure.currentInHg, settings.units)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.1em] text-series-pressure uppercase">
            <span aria-hidden="true">{TREND_ARROW[pressure.trend.direction]}</span>
            {TREND_LABEL[pressure.trend.direction]}
          </div>
        </div>

        <div className="text-right">
          <div className="micro">12-hour change</div>
          <div className="tnum mt-1 font-mono text-[15px] text-fg">
            {formatPressureDelta(pressure.change12h, settings.units)}
          </div>
        </div>
      </div>

      {hasPoints ? (
        <div className="mt-3">
          <LineChart
            series={series}
            height={116}
            ariaLabel={`Pressure over the last ${range}`}
            nowX={Date.now()}
            formatY={(value) => value.toFixed(pressureDecimals(settings.units))}
            xLabels={xLabels(series[0]?.points.map((point) => point.x) ?? [], multiDay)}
          />
          {multiDay ? (
            <p className="mt-1 text-[10px] text-faint">
              Solid line: observed. Dashed: forecast pressure.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-faint">
          Not enough pressure history yet for a {range} chart.
        </p>
      )}

      <dl className="mt-3">
        <Row label="3 hours" value={formatPressureDelta(pressure.change3h, settings.units)} />
        <Row label="6 hours" value={formatPressureDelta(pressure.change6h, settings.units)} />
        <Row label="12 hours" value={formatPressureDelta(pressure.change12h, settings.units)} />
        <Row label="24 hours" value={formatPressureDelta(pressure.change24h, settings.units)} />
        <Row
          label="Trend basis"
          value={
            <TrendIndicator
              direction={
                pressure.trend.change > 0 ? "up" : pressure.trend.change < 0 ? "down" : "flat"
              }
            >
              {`3h tendency`}
            </TrendIndicator>
          }
        />
      </dl>

      <p className="mt-3 border-l-2 border-series-pressure/60 pl-2 text-[12px] leading-snug text-muted">
        {pressure.interpretation}
      </p>
    </DashboardCard>
  );
}

/** Four evenly spaced labels; hours for short ranges, weekdays for long ones. */
function xLabels(times: number[], multiDay: boolean) {
  if (times.length < 2) return [];
  const picks = [0, Math.floor(times.length / 3), Math.floor((times.length * 2) / 3), times.length - 1];
  return [...new Set(picks)].map((index) => ({
    x: times[index],
    label: multiDay ? formatShortDay(times[index]) : formatHour(times[index]),
  }));
}
