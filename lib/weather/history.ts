import { failureMessage, fetchJson } from "../http";
import { hpaToInHg, TIME_ZONE } from "../format";
import type { Coordinates, SourceRef } from "@/types";
import type { HistoryRange, HistorySeries } from "./types";

/**
 * Observed weather history, and today measured against the recent normal.
 *
 * Two endpoints, because they answer different questions. Recent history comes
 * from the forecast API's `past_days`, which carries the last few months of
 * model-analysed values and stays current to the hour. A full year comes from
 * the ERA5 reanalysis archive, which is the better record but lags real time
 * by about five days — so it is used only where that lag does not matter.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

export const ARCHIVE_SOURCE: SourceRef = {
  name: "Open-Meteo ERA5 Archive",
  kind: "provider",
  url: "https://open-meteo.com/en/docs/historical-weather-api",
};

export const RECENT_SOURCE: SourceRef = {
  name: "Open-Meteo",
  kind: "provider",
  url: "https://open-meteo.com/",
};

/** Years of record averaged into the "vs normal" comparison. */
const NORMAL_YEARS = 10;

/** Calendar days either side of today included in the normal, to smooth noise. */
const NORMAL_WINDOW_DAYS = 5;

const UNITS = "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";

type Series = Record<string, (number | null)[]> & { time?: number[] };

type MeteoResponse = { hourly?: Series; daily?: Series };

export type HistoryFetch =
  | { ok: true; data: HistorySeries }
  | { ok: false; message: string };

export type TodayValues = {
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
};

export async function fetchHistory(
  point: Coordinates,
  range: HistoryRange,
  today: TodayValues,
): Promise<HistoryFetch> {
  const series = range === "24h" ? await hourlyHistory(point) : await dailyHistory(point, range);
  if (!series.ok) return series;

  const normals = await fetchNormals(point, today);

  return {
    ok: true,
    data: {
      range,
      points: series.points,
      normals,
      sources: range === "1y" ? [ARCHIVE_SOURCE] : [RECENT_SOURCE],
    },
  };
}

type PointsResult =
  | { ok: true; points: HistorySeries["points"] }
  | { ok: false; message: string };

async function hourlyHistory(point: Coordinates): Promise<PointsResult> {
  const url =
    `${FORECAST_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
    `&hourly=temperature_2m,pressure_msl,precipitation,wind_speed_10m` +
    `&past_days=2&forecast_days=1&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime${UNITS}`;

  const response = await fetchJson<MeteoResponse>(url, { timeoutMs: 9_000, revalidate: 0 });
  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const hourly = response.value.hourly;
  const times = hourly?.time;
  if (!hourly || !times?.length) {
    return { ok: false, message: "Provider returned no hourly history" };
  }

  const cutoff = Date.now() - 24 * 3_600_000;
  const points: HistorySeries["points"] = [];

  for (let index = 0; index < times.length; index += 1) {
    const time = times[index] * 1000;
    // Only observed hours; the forecast_days=1 tail is requested purely so
    // the series runs right up to the current hour.
    if (time < cutoff || time > Date.now()) continue;
    const pressure = numeric(hourly.pressure_msl?.[index]);
    points.push({
      time,
      temperature: numeric(hourly.temperature_2m?.[index]),
      pressureInHg: pressure === null ? null : hpaToInHg(pressure),
      precipitation: numeric(hourly.precipitation?.[index]),
      windSpeed: numeric(hourly.wind_speed_10m?.[index]),
    });
  }

  return { ok: true, points };
}

async function dailyHistory(
  point: Coordinates,
  range: Exclude<HistoryRange, "24h">,
): Promise<PointsResult> {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 365;

  // A year of daily records comes from the reanalysis archive; shorter windows
  // come from the forecast endpoint so they include the last few days, which
  // the archive has not published yet.
  const url =
    range === "1y"
      ? `${ARCHIVE_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
        `&start_date=${isoDate(days + 6)}&end_date=${isoDate(6)}` +
        `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,pressure_msl_mean` +
        `&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime${UNITS}`
      : `${FORECAST_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
        `&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
        `&hourly=pressure_msl&past_days=${days}&forecast_days=1` +
        `&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime${UNITS}`;

  const response = await fetchJson<MeteoResponse>(url, { timeoutMs: 12_000, revalidate: 0 });
  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const daily = response.value.daily;
  const times = daily?.time;
  if (!daily || !times?.length) {
    return { ok: false, message: "Provider returned no daily history" };
  }

  const hourlyPressure = response.value.hourly;
  const points: HistorySeries["points"] = [];

  for (let index = 0; index < times.length; index += 1) {
    const time = times[index] * 1000;
    if (time > Date.now()) continue;

    const archivePressure = numeric(daily.pressure_msl_mean?.[index]);
    const pressureInHg =
      archivePressure !== null
        ? hpaToInHg(archivePressure)
        : dayMeanPressure(hourlyPressure, time);

    points.push({
      time,
      temperature: numeric(daily.temperature_2m_mean?.[index]),
      temperatureMax: numeric(daily.temperature_2m_max?.[index]),
      temperatureMin: numeric(daily.temperature_2m_min?.[index]),
      pressureInHg,
      precipitation: numeric(daily.precipitation_sum?.[index]),
      windSpeed: numeric(daily.wind_speed_10m_max?.[index]),
    });
  }

  return { ok: true, points };
}

function dayMeanPressure(hourly: Series | undefined, dayStart: number): number | null {
  const times = hourly?.time;
  if (!hourly || !times?.length) return null;
  const dayEnd = dayStart + 86_400_000;

  let sum = 0;
  let count = 0;
  for (let index = 0; index < times.length; index += 1) {
    const time = times[index] * 1000;
    if (time < dayStart || time >= dayEnd) continue;
    const value = numeric(hourly.pressure_msl?.[index]);
    if (value === null) continue;
    sum += value;
    count += 1;
  }

  return count ? hpaToInHg(sum / count) : null;
}

/**
 * "Today vs normal", where normal is this calendar date averaged over the last
 * ten years rather than a 30-year climatological normal.
 *
 * Ten years of reanalysis is one request and is honest about what it is; the
 * UI labels it with the number of years so the comparison is not mistaken for
 * an official NOAA normal.
 */
async function fetchNormals(
  point: Coordinates,
  today: TodayValues,
): Promise<HistorySeries["normals"]> {
  const url =
    `${ARCHIVE_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
    `&start_date=${isoDate(NORMAL_YEARS * 365 + 6)}&end_date=${isoDate(6)}` +
    `&daily=temperature_2m_mean,precipitation_sum,wind_speed_10m_max` +
    `&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime${UNITS}`;

  const response = await fetchJson<MeteoResponse>(url, { timeoutMs: 15_000, revalidate: 0 });
  if (!response.ok) return null;

  const daily = response.value.daily;
  const times = daily?.time;
  if (!daily || !times?.length) return null;

  const todayKey = dayOfYear(new Date());
  const temperatures: number[] = [];
  const precipitations: number[] = [];
  const winds: number[] = [];

  for (let index = 0; index < times.length; index += 1) {
    const date = new Date(times[index] * 1000);
    if (!withinWindow(dayOfYear(date), todayKey)) continue;

    const temperature = numeric(daily.temperature_2m_mean?.[index]);
    if (temperature !== null) temperatures.push(temperature);
    const precipitation = numeric(daily.precipitation_sum?.[index]);
    if (precipitation !== null) precipitations.push(precipitation);
    const wind = numeric(daily.wind_speed_10m_max?.[index]);
    if (wind !== null) winds.push(wind);
  }

  if (!temperatures.length) return null;

  const compare = (value: number | null, normal: number | null) => ({
    today: value,
    normal,
    delta: value !== null && normal !== null ? value - normal : null,
  });

  return {
    temperature: compare(today.temperature, mean(temperatures)),
    precipitation: compare(today.precipitation, mean(precipitations)),
    wind: compare(today.wind, mean(winds)),
    basisYears: NORMAL_YEARS,
  };
}

/** Day-of-year distance, wrapping across the new year. */
function withinWindow(candidate: number, target: number): boolean {
  const raw = Math.abs(candidate - target);
  return Math.min(raw, 365 - raw) <= NORMAL_WINDOW_DAYS;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numeric(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isoDate(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return date.toISOString().slice(0, 10);
}
