"use client";

import { useState } from "react";
import { BarChart, LineChart, RangeBars } from "@/components/ui/charts";
import { DashboardCard, Row, Segmented, StateBlock } from "@/components/ui/primitives";
import { WeatherGlyph } from "./WeatherGlyph";
import { useSettings } from "@/lib/settings/store";
import {
  compass,
  displayPressure,
  displayTemp,
  formatInches,
  formatPercent,
  formatPressure,
  formatShortDate,
  formatShortDay,
  formatTemp,
  formatTime,
  formatWind,
  pressureDecimals,
} from "@/lib/format";
import type { DayPoint, WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The ten-day outlook.
 *
 * A row per day that expands in place, plus three charts over the same period.
 * The charts exist because ten rows of numbers do not show a pattern: a
 * warm-up arriving on Thursday is obvious as a shape and invisible as a
 * column of highs.
 *
 * Forecast pressure is averaged from the hourly series, and is shown only for
 * the days the provider actually covers — beyond that the chart simply ends
 * rather than flattening to a guess.
 */

type Chart = "temperature" | "precipitation" | "pressure";

export function TenDayForecast({ weather }: { weather: ModuleSnapshot<WeatherData> }) {
  const { settings } = useSettings();
  const [chart, setChart] = useState<Chart>("temperature");
  const [expanded, setExpanded] = useState<string | null>(null);
  const data = weather.data;

  if (!data) {
    return (
      <DashboardCard title="10-Day Forecast" status={weather.status} sources={weather.sources}>
        <StateBlock
          state={weather.status.state === "ok" ? "unavailable" : weather.status.state}
          message={weather.status.message}
          lastSuccessAt={weather.status.lastSuccessAt}
          label="Forecast"
        />
      </DashboardCard>
    );
  }

  const days = data.daily.slice(0, 10);

  return (
    <DashboardCard
      title="10-Day Forecast"
      right={
        <Segmented
          label="Forecast chart"
          value={chart}
          onChange={setChart}
          options={[
            { value: "temperature", label: "Temp" },
            { value: "precipitation", label: "Rain" },
            { value: "pressure", label: "Press" },
          ]}
        />
      }
      status={weather.status}
      sources={weather.sources}
    >
      <div className="mb-3">
        {chart === "temperature" ? (
          <LineChart
            height={120}
            ariaLabel="Ten day high and low temperatures"
            series={[
              {
                key: "high",
                points: days.map((day, index) => ({
                  x: index,
                  y: displayTemp(day.high, settings.units),
                })),
                color: "var(--color-series-temp)",
                fill: true,
              },
              {
                key: "low",
                points: days.map((day, index) => ({
                  x: index,
                  y: displayTemp(day.low, settings.units),
                })),
                color: "var(--color-series-pressure)",
              },
            ]}
            xLabels={days.map((day, index) => ({ x: index, label: formatShortDay(day.time) }))}
          />
        ) : null}

        {chart === "precipitation" ? (
          <BarChart
            height={120}
            ariaLabel="Ten day rain probability"
            color="var(--color-series-rain)"
            max={100}
            formatValue={(value) => `${Math.round(value)}%`}
            points={days.map((day) => ({
              x: 0,
              y: day.precipProbability,
              highlight: (day.precipProbability ?? 0) >= 50,
            }))}
            xLabels={days.map((day, index) => ({ x: index, label: formatShortDay(day.time) }))}
          />
        ) : null}

        {chart === "pressure" ? (
          days.some((day) => day.pressureInHg !== null) ? (
            <LineChart
              height={120}
              ariaLabel="Ten day mean pressure"
              formatY={(value) => value.toFixed(pressureDecimals(settings.units))}
              series={[
                {
                  key: "pressure",
                  points: days.map((day, index) => ({
                    x: index,
                    y:
                      day.pressureInHg === null
                        ? null
                        : displayPressure(day.pressureInHg, settings.units),
                  })),
                  color: "var(--color-series-pressure)",
                  fill: true,
                },
              ]}
              xLabels={days.map((day, index) => ({ x: index, label: formatShortDay(day.time) }))}
            />
          ) : (
            <p className="py-6 text-center text-[11px] text-faint">
              Forecast pressure is not available for this location.
            </p>
          )
        ) : null}
      </div>

      <div className="mb-3 border-y hairline border-line py-2">
        <RangeBars
          ariaLabel="Ten day temperature ranges"
          rows={days.map((day, index) => ({
            label: index === 0 ? "Today" : formatShortDay(day.time),
            low: displayTemp(day.low, settings.units),
            high: displayTemp(day.high, settings.units),
            accent: index === 0,
          }))}
        />
      </div>

      <ul>
        {days.map((day, index) => {
          const open = expanded === day.date;
          return (
            <li key={day.date} className="border-b hairline border-line/60 last:border-0">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : day.date)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 py-2 text-left transition-colors hover:bg-raised/40"
              >
                <span className="w-9 shrink-0 text-[11px] font-semibold tracking-wide text-fg uppercase">
                  {index === 0 ? "Today" : formatShortDay(day.time)}
                </span>
                <span className="tnum w-10 shrink-0 font-mono text-[10px] text-faint">
                  {formatShortDate(day.time)}
                </span>
                <WeatherGlyph code={day.conditionCode} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                  {day.condition}
                </span>
                <span
                  className={`tnum w-9 shrink-0 text-right font-mono text-[11px] ${
                    (day.precipProbability ?? 0) >= 50 ? "text-series-rain" : "text-faint"
                  }`}
                >
                  {formatPercent(day.precipProbability)}
                </span>
                <span className="tnum w-14 shrink-0 text-right font-mono text-[13px]">
                  <span className="text-series-temp">{formatTemp(day.high, settings.units)}</span>
                  <span className="mx-0.5 text-line-strong">/</span>
                  <span className="text-series-pressure">{formatTemp(day.low, settings.units)}</span>
                </span>
              </button>

              {open ? <DayDetail day={day} /> : null}
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}

function DayDetail({ day }: { day: DayPoint }) {
  const { settings } = useSettings();

  return (
    <div className="animate-fade bg-ink/40 px-2 pt-1 pb-3">
      <dl>
        <Row label="Condition" value={day.condition} />
        <Row label="High / Low" value={`${formatTemp(day.high, settings.units)} / ${formatTemp(day.low, settings.units)}`} />
        <Row label="Rain probability" value={formatPercent(day.precipProbability)} />
        <Row label="Precipitation" value={formatInches(day.precipitation)} />
        <Row label="Wind" value={`${formatWind(day.windSpeed, settings.units)} ${compass(day.windDirection)}`} />
        <Row label="Gusts" value={formatWind(day.windGust, settings.units)} />
        <Row
          label="Mean pressure"
          value={day.pressureInHg === null ? "—" : formatPressure(day.pressureInHg, settings.units)}
        />
        <Row label="UV index (max)" value={day.uvIndexMax === null ? "—" : day.uvIndexMax.toFixed(1)} />
        <Row label="Sunrise" value={formatTime(day.sunrise)} />
        <Row label="Sunset" value={formatTime(day.sunset)} />
      </dl>
    </div>
  );
}
