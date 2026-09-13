"use client";

import { useEffect, useState } from "react";
import { BarChart, LineChart } from "@/components/ui/charts";
import {
  DashboardCard,
  Loading,
  Row,
  Segmented,
  StateBlock,
} from "@/components/ui/primitives";
import { useSettings } from "@/lib/settings/store";
import {
  displayPressure,
  displayTemp,
  displayWind,
  formatShortDate,
  formatHour,
  pressureDecimals,
} from "@/lib/format";
import type { HistoryRange, HistorySeries } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Observed history, and today measured against the recent normal.
 *
 * Loaded on demand rather than with the dashboard: a year of daily records is
 * a large response for a panel most visits never open, and the Today page has
 * no use for it. The "vs normal" comparison names the number of years it
 * averages, because a ten-year mean is not a thirty-year climatological normal
 * and should not be read as one.
 */

type Metric = "temperature" | "pressure" | "precipitation" | "wind";

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "1y", label: "1Y" },
];

const METRICS: { value: Metric; label: string }[] = [
  { value: "temperature", label: "Temp" },
  { value: "pressure", label: "Press" },
  { value: "precipitation", label: "Rain" },
  { value: "wind", label: "Wind" },
];

export function HistoryPanel() {
  const { settings } = useSettings();
  const [range, setRange] = useState<HistoryRange>("24h");
  const [metric, setMetric] = useState<Metric>("temperature");
  const [snapshot, setSnapshot] = useState<ModuleSnapshot<HistorySeries> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch(`/api/history?range=${range}`);
        const body = (await response.json()) as ModuleSnapshot<HistorySeries>;
        if (!cancelled) setSnapshot(body);
      } catch {
        if (!cancelled) setSnapshot(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const data = snapshot?.data ?? null;

  return (
    <DashboardCard
      title="Historical Weather"
      right={
        <div className="flex gap-1">
          <Segmented label="History range" value={range} onChange={setRange} options={RANGES} />
        </div>
      }
      status={snapshot?.status}
      sources={snapshot?.sources}
    >
      <div className="mb-3">
        <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS} />
      </div>

      {loading ? (
        <Loading lines={4} label="Loading historical weather" />
      ) : !data || data.points.length < 2 ? (
        <StateBlock
          state={snapshot?.status.state === "ok" ? "unavailable" : (snapshot?.status.state ?? "unavailable")}
          message={snapshot?.status.message ?? "No historical observations returned for this range."}
          lastSuccessAt={snapshot?.status.lastSuccessAt}
          label="Historical"
        />
      ) : (
        <>
          {metric === "precipitation" ? (
            <BarChart
              height={130}
              ariaLabel={`Precipitation over the last ${range}`}
              color="var(--color-series-rain)"
              points={data.points.map((point) => ({
                x: 0,
                y: point.precipitation,
                highlight: (point.precipitation ?? 0) > 0.25,
              }))}
              xLabels={labelsFor(data, range)}
            />
          ) : (
            <LineChart
              height={130}
              ariaLabel={`${metric} over the last ${range}`}
              formatY={
                metric === "pressure"
                  ? (value) => value.toFixed(pressureDecimals(settings.units))
                  : undefined
              }
              series={[
                {
                  key: metric,
                  points: data.points.map((point, index) => ({
                    x: range === "24h" ? point.time : index,
                    y: valueFor(point, metric, settings),
                  })),
                  color:
                    metric === "temperature"
                      ? "var(--color-series-temp)"
                      : metric === "pressure"
                        ? "var(--color-series-pressure)"
                        : "var(--color-series-wind)",
                  fill: true,
                },
              ]}
              xLabels={labelsFor(data, range)}
            />
          )}

          {data.normals ? (
            <div className="mt-4">
              <h3 className="micro">
                Today vs normal · {data.normals.basisYears}-year average for this date
              </h3>
              <dl className="mt-1.5">
                <Row
                  label="Temperature"
                  value={delta(data.normals.temperature.delta, "°", settings, "temperature")}
                />
                <Row
                  label="Precipitation"
                  value={delta(data.normals.precipitation.delta, '"', settings, "raw")}
                />
                <Row label="Wind" value={delta(data.normals.wind.delta, " MPH", settings, "wind")} />
              </dl>
              <p className="mt-2 text-[10px] leading-snug text-faint">
                A {data.normals.basisYears}-year mean of reanalysis data for the days around
                today, not an official NOAA climatological normal.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-faint">
              The archive could not be reached, so there is no comparison against normal.
            </p>
          )}
        </>
      )}
    </DashboardCard>
  );
}

function valueFor(
  point: HistorySeries["points"][number],
  metric: Metric,
  settings: ReturnType<typeof useSettings>["settings"],
): number | null {
  switch (metric) {
    case "temperature":
      return point.temperature === null ? null : displayTemp(point.temperature, settings.units);
    case "pressure":
      return point.pressureInHg === null
        ? null
        : displayPressure(point.pressureInHg, settings.units);
    case "wind":
      return point.windSpeed === null ? null : displayWind(point.windSpeed, settings.units);
    default:
      return point.precipitation;
  }
}

function delta(
  value: number | null,
  unit: string,
  settings: ReturnType<typeof useSettings>["settings"],
  convert: "temperature" | "wind" | "raw",
) {
  if (value === null) return "—";

  // Deltas are differences, so a temperature delta converts by ratio rather
  // than through the full Fahrenheit-to-Celsius offset.
  const converted =
    convert === "temperature" && settings.units.temperature === "C"
      ? value * (5 / 9)
      : convert === "wind"
        ? displayWind(value, settings.units) - displayWind(0, settings.units)
        : value;

  const sign = converted > 0 ? "+" : converted < 0 ? "−" : "";
  const magnitude = Math.abs(converted);
  const text = unit === '"' ? magnitude.toFixed(2) : String(Math.round(magnitude * 10) / 10);

  return (
    <span className={converted > 0 ? "text-level-moderate" : converted < 0 ? "text-series-pressure" : ""}>
      {sign}
      {text}
      {unit} vs average
    </span>
  );
}

/** Four labels across the series; times for a day, dates for longer ranges. */
function labelsFor(data: HistorySeries, range: HistoryRange) {
  const points = data.points;
  if (points.length < 2) return [];

  const picks = [0, Math.floor(points.length / 3), Math.floor((points.length * 2) / 3), points.length - 1];
  return [...new Set(picks)].map((index) => ({
    x: range === "24h" ? points[index].time : index,
    label:
      range === "24h" ? formatHour(points[index].time) : formatShortDate(points[index].time),
  }));
}
