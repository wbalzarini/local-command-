import { TIME_ZONE } from "../format";
import { condition } from "./conditions";
import type {
  CurrentConditions,
  HourPoint,
  MetricTrend,
  WeatherTrends,
} from "./types";

/**
 * The trend engine: how six metrics are moving across the next 24 hours.
 *
 * Forward-looking on purpose. Comparing today with yesterday is the "What
 * Changed" module's job, so this one answers the different question of what is
 * developing — which is what changes a decision about the afternoon.
 *
 * Each change is the window's most extreme value measured against now, not the
 * value at the window's end. That distinction matters more than it looks:
 * temperature, humidity and cloud cover all cycle daily, so "24 hours from now
 * minus now" lands back near zero for every one of them and reports a flat day
 * whatever the weather does in between. The extreme is also what people
 * actually mean by a trend — a 70% chance of rain at 2pm matters even if it has
 * cleared by midnight.
 *
 * `notable` carries the visual emphasis, and its thresholds are set at the
 * point a change is worth a glance rather than merely detectable.
 */

const THRESHOLD = {
  temperature: 5,
  pressure: 0.05,
  precipProbability: 20,
  wind: 7,
  cloudCover: 30,
  humidity: 15,
} as const;

export function analyseTrends(
  recent: HourPoint[],
  current: CurrentConditions,
  forward: HourPoint[],
  windowHours = 24,
): WeatherTrends {
  const horizon = forward.filter(
    (hour) => hour.time <= current.observedAt + windowHours * 3_600_000,
  );
  const end = horizon.length ? horizon[horizon.length - 1] : null;

  if (!end) {
    return {
      windowHours,
      metrics: [],
      interpretation: "Not enough forecast data to describe a trend.",
    };
  }

  const metrics: MetricTrend[] = [
    metric(
      "temperature",
      "Temperature",
      current.temperature,
      extreme(horizon, current.temperature, (hour) => hour.temperature),
      "°",
      THRESHOLD.temperature,
    ),
    metric(
      "pressure",
      "Pressure",
      current.pressureInHg,
      extreme(horizon, current.pressureInHg, (hour) => hour.pressureInHg),
      " inHg",
      THRESHOLD.pressure,
      2,
    ),
    metric(
      "precipProbability",
      "Rain Probability",
      current.precipProbability,
      // Rain only ever reads as a peak: a drop in an already-low chance is not
      // a trend anyone needs.
      peak(horizon, (hour) => hour.precipProbability),
      "%",
      THRESHOLD.precipProbability,
    ),
    metric(
      "wind",
      "Wind",
      current.windSpeed,
      peak(horizon, (hour) => hour.windSpeed),
      " MPH",
      THRESHOLD.wind,
    ),
    metric(
      "cloudCover",
      "Cloud Cover",
      current.cloudCover,
      extreme(horizon, current.cloudCover, (hour) => hour.cloudCover),
      "%",
      THRESHOLD.cloudCover,
    ),
    metric(
      "humidity",
      "Humidity",
      current.humidity,
      extreme(horizon, current.humidity, (hour) => hour.humidity),
      "%",
      THRESHOLD.humidity,
    ),
  ].filter((entry): entry is MetricTrend => entry !== null);

  void end;

  return {
    windowHours,
    metrics,
    interpretation: interpret(metrics, horizon, recent),
  };
}

function metric(
  key: string,
  label: string,
  from: number | null,
  to: number | null,
  unit: string,
  threshold: number,
  decimals = 0,
): MetricTrend | null {
  if (from === null || to === null) return null;
  const change = Number((to - from).toFixed(decimals + 2));
  return {
    key,
    label,
    change,
    unit,
    direction: Math.abs(change) < Number.EPSILON ? "flat" : change > 0 ? "up" : "down",
    notable: Math.abs(change) >= threshold,
  };
}

/**
 * The value furthest from `from`, in either direction.
 *
 * Signed by whichever extreme is further away, so an overnight low reads as a
 * fall and an afternoon peak as a rise, rather than the two cancelling.
 */
function extreme(
  hours: HourPoint[],
  from: number | null,
  select: (hour: HourPoint) => number | null,
): number | null {
  if (from === null) return null;

  let furthest: number | null = null;
  let distance = 0;
  for (const hour of hours) {
    const value = select(hour);
    if (value === null) continue;
    const candidate = Math.abs(value - from);
    if (candidate > distance) {
      distance = candidate;
      furthest = value;
    }
  }
  return furthest;
}

/**
 * The highest value in the window.
 *
 * Rain probability and wind are read as peaks rather than extremes because a
 * 70% chance at 2pm that falls back to 20% by evening still means taking a
 * coat, and a fall in an already-low chance is not news.
 */
function peak(
  hours: HourPoint[],
  select: (hour: HourPoint) => number | null,
): number | null {
  let best: number | null = null;
  for (const hour of hours) {
    const value = select(hour);
    if (value === null) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

function interpret(
  metrics: MetricTrend[],
  horizon: HourPoint[],
  recent: HourPoint[],
): string {
  const notable = metrics.filter((entry) => entry.notable);
  const clauses: string[] = [];

  const find = (key: string) => notable.find((entry) => entry.key === key);

  const temperature = find("temperature");
  if (temperature) {
    clauses.push(
      `temperatures ${temperature.direction === "up" ? "climbing" : "dropping"} about ${Math.abs(Math.round(temperature.change))}°`,
    );
  }

  const pressure = find("pressure");
  if (pressure) {
    clauses.push(
      `pressure ${pressure.direction === "up" ? "rising" : "falling"} ${Math.abs(pressure.change).toFixed(2)} inHg`,
    );
  }

  const rain = find("precipProbability");
  if (rain && rain.direction === "up") {
    // The hour that actually holds the peak, so the timing is the forecast's
    // and not an approximation of it.
    const peakValue = Math.max(...horizon.map((hour) => hour.precipProbability ?? 0));
    const wettest = horizon.find((hour) => (hour.precipProbability ?? 0) === peakValue);
    const timing = wettest
      ? ` to ${Math.round(peakValue)}% around ${new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric" }).format(new Date(wettest.time))}`
      : "";
    clauses.push(`rain chances increasing${timing}`);
  }

  const wind = find("wind");
  if (wind && wind.direction === "up") {
    clauses.push(`wind picking up by around ${Math.round(Math.abs(wind.change))} MPH`);
  }

  if (!clauses.length) {
    const stable = recent.length
      ? "Conditions have been steady and the next 24 hours look much the same."
      : "No significant changes in the next 24 hours.";
    return stable;
  }

  const wettestCode = horizon.find((hour) => condition(hour.conditionCode).family === "storm");
  const stormNote = wettestCode ? " Thunderstorms appear in the forecast window." : "";

  return `Next 24 hours: ${clauses.join(", ")}.${stormNote}`;
}
