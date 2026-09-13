"use client";

import { DashboardCard, StateBlock } from "@/components/ui/primitives";
import { WeatherGlyph } from "./WeatherGlyph";
import { useSettings } from "@/lib/settings/store";
import { compass, formatHour, formatInches, formatTemp } from "@/lib/format";
import type { WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The next 24 hours.
 *
 * A horizontally scrolling strip rather than a wrapped grid: time is one
 * dimension and reading it as one is faster than hunting across rows. Each
 * column carries the full set — temperature, condition, rain probability,
 * precipitation, wind and pressure — so the strip answers detail questions
 * without a tap.
 */
export function HourlyForecast({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const { settings } = useSettings();
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="Hourly" status={weather.status} sources={weather.sources}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Hourly forecast"
        />
      </DashboardCard>
    );
  }

  const hours = data.hourly.slice(0, 24);

  return (
    <DashboardCard
      title="Next 24 Hours"
      subtitle="Scroll for the full day"
      status={weather.status}
      sources={weather.sources}
    >
      <div className="strip scroll-none -mx-3 px-3">
        {hours.map((hour, index) => (
          <div
            key={hour.time}
            className={`w-[3.9rem] border-r hairline border-line px-1.5 py-1 text-center last:border-0 ${
              index === 0 ? "bg-raised/40" : ""
            }`}
          >
            <div className="micro">{index === 0 ? "NOW" : formatHour(hour.time)}</div>

            <div className="tnum mt-1.5 font-mono text-[15px] text-fg">
              {formatTemp(hour.temperature, settings.units)}
            </div>

            <div className="mt-1.5 flex justify-center">
              <WeatherGlyph code={hour.conditionCode} isDay={hour.isDay} className="size-4" />
            </div>

            <div
              className={`tnum mt-1.5 font-mono text-[11px] ${
                (hour.precipProbability ?? 0) >= 50 ? "text-series-rain" : "text-faint"
              }`}
            >
              {hour.precipProbability === null ? "—" : `${Math.round(hour.precipProbability)}%`}
            </div>

            <div className="tnum mt-0.5 font-mono text-[9px] text-faint">
              {hour.precipitation ? formatInches(hour.precipitation) : "—"}
            </div>

            <div className="tnum mt-1 font-mono text-[9px] text-faint">
              {hour.windSpeed === null ? "—" : Math.round(hour.windSpeed)}
              <span className="ml-0.5">{compass(hour.windDirection)}</span>
            </div>

            <div className="tnum mt-0.5 font-mono text-[9px] text-faint">
              {hour.pressureInHg === null ? "—" : hour.pressureInHg.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-faint">
        Rows: temperature · condition · rain probability · precipitation · wind · pressure
      </p>
    </DashboardCard>
  );
}
