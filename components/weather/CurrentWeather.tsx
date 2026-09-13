"use client";

import { DashboardCard, Metric, Row, StateBlock } from "@/components/ui/primitives";
import { WeatherGlyph } from "./WeatherGlyph";
import { useSettings } from "@/lib/settings/store";
import {
  compass,
  formatInches,
  formatPercent,
  formatTemp,
  formatTime,
  formatWind,
} from "@/lib/format";
import type { WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Current conditions.
 *
 * The temperature is the largest number on the dashboard and everything else
 * is tabulated beneath it, which is the hierarchy someone glancing at this
 * actually wants: one figure to read from across the room, and the detail
 * available without a tap when they care.
 */
export function CurrentWeather({
  weather,
  compact = false,
}: {
  weather: ModuleSnapshot<WeatherData>;
  /** Drops the secondary table, for the three-across row on Today. */
  compact?: boolean;
}) {
  const { settings } = useSettings();
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="Weather" status={weather.status} sources={weather.sources}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Weather"
        />
      </DashboardCard>
    );
  }

  const { current } = data;
  const units = settings.units;

  return (
    <DashboardCard
      title="Weather"
      subtitle={current.condition}
      status={weather.status}
      sources={weather.sources}
      right={<WeatherGlyph code={current.conditionCode} isDay={current.isDay} className="size-8" />}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="tnum font-mono text-5xl leading-none text-fg">
            {formatTemp(current.temperature, units)}
          </div>
          <div className="mt-1.5 text-[12px] text-muted">
            Feels like {formatTemp(current.feelsLike, units)}
          </div>
        </div>

        <div className="text-right">
          <div className="micro">High / Low</div>
          <div className="tnum mt-1 font-mono text-[15px] text-fg">
            <span className="text-series-temp">{formatTemp(current.high, units)}</span>
            <span className="mx-1 text-line-strong">/</span>
            <span className="text-series-pressure">{formatTemp(current.low, units)}</span>
          </div>
        </div>
      </div>

      {compact ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric
            label="Wind"
            value={formatWind(current.windSpeed, units)}
            sub={compass(current.windDirection)}
            size="sm"
          />
          <Metric
            label="Rain"
            value={formatPercent(current.precipProbability)}
            sub="next hour"
            size="sm"
          />
        </div>
      ) : (
        <dl className="mt-3">
          <Row
            label="Wind"
            value={`${formatWind(current.windSpeed, units)} ${compass(current.windDirection)}`}
          />
          <Row
            label="Gusts"
            value={current.windGust === null ? "—" : formatWind(current.windGust, units)}
          />
          <Row label="Humidity" value={formatPercent(current.humidity)} />
          <Row
            label="Dew point"
            value={current.dewPoint === null ? "—" : formatTemp(current.dewPoint, units)}
          />
          <Row
            label="Visibility"
            value={
              current.visibilityMiles === null
                ? "—"
                : `${current.visibilityMiles.toFixed(1)} mi`
            }
          />
          <Row label="Precipitation" value={formatInches(current.precipitation)} />
          <Row label="Rain probability" value={formatPercent(current.precipProbability)} />
          <Row label="Cloud cover" value={formatPercent(current.cloudCover)} />
          <Row
            label="UV index"
            value={current.uvIndex === null ? "—" : current.uvIndex.toFixed(1)}
          />
          <Row label="Sunrise" value={formatTime(current.sunrise)} />
          <Row label="Sunset" value={formatTime(current.sunset)} />
        </dl>
      )}
    </DashboardCard>
  );
}
