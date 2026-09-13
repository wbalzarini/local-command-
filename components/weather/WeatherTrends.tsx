"use client";

import { Sparkline } from "@/components/ui/charts";
import { DashboardCard, StateBlock, TrendIndicator } from "@/components/ui/primitives";
import type { HourPoint, WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The trend table.
 *
 * Six metrics, one row each, each with the change across the window and a
 * sparkline of the path it takes to get there — because "+7 MPH" reads very
 * differently depending on whether it climbs steadily or spikes for one hour.
 *
 * Rows the engine marked notable are brightened; the rest stay quiet. That is
 * the whole point of the `notable` flag: the table should be scannable down to
 * the two rows that matter today.
 */

const SERIES_COLOUR: Record<string, string> = {
  temperature: "var(--color-series-temp)",
  pressure: "var(--color-series-pressure)",
  precipProbability: "var(--color-series-rain)",
  wind: "var(--color-series-wind)",
  cloudCover: "var(--color-series-cloud)",
  humidity: "var(--color-series-rain)",
};

const PICKER: Record<string, (hour: HourPoint) => number | null> = {
  temperature: (hour) => hour.temperature,
  pressure: (hour) => hour.pressureInHg,
  precipProbability: (hour) => hour.precipProbability,
  wind: (hour) => hour.windSpeed,
  cloudCover: (hour) => hour.cloudCover,
  humidity: (hour) => hour.humidity,
};

export function WeatherTrends({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="Weather Trends" status={weather.status} sources={weather.sources}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Trend"
        />
      </DashboardCard>
    );
  }

  const { trends, hourly, current } = data;
  const window = hourly.filter(
    (hour) => hour.time <= current.observedAt + trends.windowHours * 3_600_000,
  );

  return (
    <DashboardCard
      title={`Weather Trends · Next ${trends.windowHours} Hours`}
      status={weather.status}
      sources={weather.sources}
    >
      {trends.metrics.length === 0 ? (
        <StateBlock state="unavailable" label="Trend" message={trends.interpretation} />
      ) : (
        <>
          <dl className="space-y-0">
            {trends.metrics.map((metric) => (
              <div
                key={metric.key}
                className="flex items-center gap-3 border-b hairline border-line/60 py-2 last:border-0"
              >
                <dt
                  className={`w-32 shrink-0 text-[11px] tracking-wide uppercase ${
                    metric.notable ? "text-muted" : "text-faint"
                  }`}
                >
                  {metric.label}
                </dt>

                <dd className="flex flex-1 items-center justify-between gap-3">
                  <Sparkline
                    values={window.map((hour) => PICKER[metric.key]?.(hour) ?? null)}
                    color={SERIES_COLOUR[metric.key] ?? "var(--color-muted)"}
                    width={72}
                  />

                  <span className={`text-[13px] ${metric.notable ? "" : "opacity-70"}`}>
                    <TrendIndicator direction={metric.direction} emphasis={metric.notable}>
                      {format(metric.change, metric.unit)}
                    </TrendIndicator>
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 border-l-2 border-line-strong pl-2 text-[12px] leading-snug text-muted">
            {trends.interpretation}
          </p>
        </>
      )}
    </DashboardCard>
  );
}

function format(change: number, unit: string): string {
  const magnitude = Math.abs(change);
  const value = unit === " inHg" ? magnitude.toFixed(2) : String(Math.round(magnitude));
  return `${value}${unit}`;
}
