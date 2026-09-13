import { fetchJson, failureMessage, type FetchResult } from "../http";
import { hpaToInHg, TIME_ZONE } from "../format";
import { condition } from "./conditions";
import type {
  CurrentConditions,
  DayPoint,
  Daylight,
  HourPoint,
  WeatherData,
} from "./types";
import type { Coordinates } from "@/types";
import { analysePressure } from "./pressure";
import { analyseTrends } from "./trends";

/**
 * Open-Meteo as the forecast provider.
 *
 * Chosen because it needs no API key, which means a fresh clone of this repo
 * shows real weather for Avondale rather than sample data. It publishes the
 * whole set the dashboard needs from one call — current conditions, 11 days of
 * hourly at mean-sea-level pressure, and daily aggregates — so the Today page
 * costs a single upstream request.
 *
 * Official severe-weather alerts deliberately do *not* come from here; those
 * come from the National Weather Service in ./nws.ts.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Open-Meteo caps visibility at 15 miles expressed in metres. */
const MAX_VISIBILITY_METERS = 24_140;

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "pressure_msl",
  "cloud_cover",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "uv_index",
  "is_day",
].join(",");

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
].join(",");

type OpenMeteoResponse = {
  current?: Record<string, number>;
  hourly?: Record<string, (number | null)[]> & { time?: number[] };
  daily?: Record<string, (number | null)[]> & { time?: number[] };
};

export type WeatherFetch =
  | { ok: true; data: WeatherData }
  | { ok: false; message: string };

export async function fetchOpenMeteo(
  point: Coordinates,
  /** Days of history to pull, for trends and the day-over-day comparison. */
  pastDays = 2,
): Promise<WeatherFetch> {
  const url =
    `${FORECAST_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lon.toFixed(4)}` +
    `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}` +
    `&past_days=${pastDays}&forecast_days=11` +
    `&timezone=${encodeURIComponent(TIME_ZONE)}&timeformat=unixtime` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

  const response: FetchResult<OpenMeteoResponse> = await fetchJson(url, {
    timeoutMs: 9_000,
    // lib/cache.ts already bounds how often this runs; a second cache layer
    // here would only make "last updated" lie.
    revalidate: 0,
  });

  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const parsed = normalise(response.value);
  return parsed
    ? { ok: true, data: parsed }
    : { ok: false, message: "Provider response was missing required fields" };
}

function normalise(raw: OpenMeteoResponse): WeatherData | null {
  const hourlyTimes = raw.hourly?.time;
  const dailyTimes = raw.daily?.time;
  if (!raw.current || !hourlyTimes?.length || !dailyTimes?.length) return null;

  const hours = buildHours(raw, hourlyTimes);
  if (!hours.length) return null;

  const days = buildDays(raw, dailyTimes, hours);
  if (!days.length) return null;

  const nowSeconds = raw.current.time ?? Math.floor(Date.now() / 1000);

  // The hour containing "now". Everything before it is observation, everything
  // from it on is forecast, and the two are never mixed in a chart.
  let currentIndex = hours.findIndex((hour) => hour.time > nowSeconds * 1000) - 1;
  if (currentIndex < 0) currentIndex = hours.length - 1;

  const currentHour = hours[currentIndex];
  const recentHourly = hours.slice(0, currentIndex);
  const forwardHourly = hours.slice(currentIndex);

  const today =
    days.find((day) => day.time <= nowSeconds * 1000 && nowSeconds * 1000 < day.time + 86_400_000) ??
    days[0];

  const current = buildCurrent(raw.current, currentHour, today, nowSeconds);
  const pressureHistory = [
    ...recentHourly
      .filter((hour) => hour.pressureInHg !== null)
      .map((hour) => ({ time: hour.time, pressureInHg: hour.pressureInHg as number })),
    { time: current.observedAt, pressureInHg: current.pressureInHg },
  ];

  const yesterdayIndex = days.findIndex((day) => day.date === today.date) - 1;
  const yesterday =
    yesterdayIndex >= 0
      ? {
          high: days[yesterdayIndex].high,
          low: days[yesterdayIndex].low,
          precipitation: days[yesterdayIndex].precipitation,
        }
      : null;

  return {
    current,
    hourly: forwardHourly,
    recentHourly,
    // Today first, then the ten-day outlook; past days are not forecast.
    daily: days.filter((day) => day.time >= today.time).slice(0, 11),
    pressure: analysePressure(pressureHistory, current.pressureInHg),
    trends: analyseTrends(recentHourly, current, forwardHourly),
    daylight: buildDaylight(today, nowSeconds * 1000),
    yesterday,
  };
}

function buildHours(raw: OpenMeteoResponse, times: number[]): HourPoint[] {
  const hourly = raw.hourly;
  if (!hourly) return [];
  const at = (field: string, index: number): number | null => {
    const series = hourly[field];
    const value = series?.[index];
    return typeof value === "number" ? value : null;
  };

  const hours: HourPoint[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const temperature = at("temperature_2m", index);
    // A temperature is the one field an hour cannot do without; a gap in the
    // model output is dropped rather than drawn as zero.
    if (temperature === null) continue;

    const pressureHpa = at("pressure_msl", index);
    const visibilityMeters = at("visibility", index);

    hours.push({
      time: times[index] * 1000,
      temperature,
      feelsLike: at("apparent_temperature", index),
      humidity: at("relative_humidity_2m", index),
      dewPoint: at("dew_point_2m", index),
      precipProbability: at("precipitation_probability", index),
      precipitation: at("precipitation", index),
      conditionCode: at("weather_code", index) ?? 3,
      pressureInHg: pressureHpa === null ? null : hpaToInHg(pressureHpa),
      cloudCover: at("cloud_cover", index),
      windSpeed: at("wind_speed_10m", index),
      windGust: at("wind_gusts_10m", index),
      windDirection: at("wind_direction_10m", index),
      visibilityMiles: toMiles(visibilityMeters),
      uvIndex: at("uv_index", index),
      isDay: (at("is_day", index) ?? 1) === 1,
    });
  }
  return hours;
}

function buildDays(
  raw: OpenMeteoResponse,
  times: number[],
  hours: HourPoint[],
): DayPoint[] {
  const daily = raw.daily;
  if (!daily) return [];
  const at = (field: string, index: number): number | null => {
    const series = daily[field];
    const value = series?.[index];
    return typeof value === "number" ? value : null;
  };

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const days: DayPoint[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const high = at("temperature_2m_max", index);
    const low = at("temperature_2m_min", index);
    if (high === null || low === null) continue;

    const startMs = times[index] * 1000;
    const code = at("weather_code", index) ?? 3;

    days.push({
      date: dateKey.format(new Date(startMs)),
      time: startMs,
      conditionCode: code,
      condition: condition(code).label,
      high,
      low,
      precipProbability: at("precipitation_probability_max", index),
      precipitation: at("precipitation_sum", index),
      windSpeed: at("wind_speed_10m_max", index),
      windGust: at("wind_gusts_10m_max", index),
      windDirection: at("wind_direction_10m_dominant", index),
      sunrise: (at("sunrise", index) ?? 0) * 1000,
      sunset: (at("sunset", index) ?? 0) * 1000,
      daylightSeconds: at("daylight_duration", index),
      uvIndexMax: at("uv_index_max", index),
      // Averaged from the hourly series rather than requested as a daily
      // field, because daily mean pressure is not published for every model
      // and a missing series would silently blank the forecast pressure chart.
      pressureInHg: meanPressure(hours, startMs),
    });
  }
  return days;
}

function meanPressure(hours: HourPoint[], dayStartMs: number): number | null {
  const dayEnd = dayStartMs + 86_400_000;
  const values = hours
    .filter((hour) => hour.time >= dayStartMs && hour.time < dayEnd)
    .map((hour) => hour.pressureInHg)
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildCurrent(
  current: Record<string, number>,
  hour: HourPoint,
  today: DayPoint,
  nowSeconds: number,
): CurrentConditions {
  const code = current.weather_code ?? hour.conditionCode;
  const pressureHpa = current.pressure_msl;

  return {
    observedAt: (current.time ?? nowSeconds) * 1000,
    temperature: current.temperature_2m ?? hour.temperature,
    feelsLike: current.apparent_temperature ?? hour.feelsLike ?? hour.temperature,
    conditionCode: code,
    condition: condition(code).label,
    isDay: (current.is_day ?? (hour.isDay ? 1 : 0)) === 1,
    high: today.high,
    low: today.low,
    humidity: current.relative_humidity_2m ?? hour.humidity ?? 0,
    // Not published in the current block, so taken from the containing hour.
    dewPoint: hour.dewPoint,
    windSpeed: current.wind_speed_10m ?? hour.windSpeed ?? 0,
    windDirection: current.wind_direction_10m ?? hour.windDirection ?? 0,
    windGust: current.wind_gusts_10m ?? hour.windGust,
    visibilityMiles: hour.visibilityMiles,
    precipitation: current.precipitation ?? 0,
    precipProbability: hour.precipProbability,
    pressureInHg:
      typeof pressureHpa === "number" ? hpaToInHg(pressureHpa) : (hour.pressureInHg ?? 0),
    cloudCover: current.cloud_cover ?? hour.cloudCover ?? 0,
    uvIndex: hour.uvIndex,
    sunrise: today.sunrise,
    sunset: today.sunset,
  };
}

function buildDaylight(today: DayPoint, nowMs: number): Daylight {
  const daylightSeconds =
    today.daylightSeconds ?? Math.max(0, (today.sunset - today.sunrise) / 1000);
  const remainingSeconds = Math.max(0, Math.round((today.sunset - nowMs) / 1000));

  // Golden hour is only meaningful while the sun is still up.
  const goldenHourStart = today.sunset > nowMs ? today.sunset - 60 * 60 * 1000 : null;

  return {
    sunrise: today.sunrise,
    sunset: today.sunset,
    daylightSeconds,
    remainingSeconds,
    goldenHourStart,
    goldenHourEnd: goldenHourStart === null ? null : today.sunset,
  };
}

function toMiles(meters: number | null): number | null {
  if (meters === null) return null;
  return Math.min(meters, MAX_VISIBILITY_METERS) / 1609.344;
}
