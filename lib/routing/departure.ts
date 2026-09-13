import type { Settings } from "../config";
import { formatClock, localParts, parseClock, TIME_ZONE } from "../format";
import { condition, isFrozen, isWet } from "../weather/conditions";
import type { HourPoint, WeatherData } from "../weather/types";
import type { CommuteImpact, DepartureRecommendation, RoadRisk, Route } from "./types";

/**
 * Weather-adjusted departure planning.
 *
 * Two calculations, both deliberately transparent: the weather impact scores
 * the drive using the forecast for the hour the drive actually happens (not
 * the weather outside right now, which is a different thing at 6am), and the
 * departure recommendation adds the traffic delay and that weather buffer to
 * the drive time and works backwards from the target arrival.
 *
 * Every number the recommendation uses is reported alongside it, so a
 * suggestion to leave twenty minutes early can be checked rather than trusted.
 */

/** Risk points per factor. The sum picks the road-risk band. */
const POINTS = {
  lightRain: 1,
  heavyRain: 2,
  frozen: 3,
  lowVisibility: 2,
  veryLowVisibility: 3,
  strongGust: 1,
  darkness: 1,
} as const;

const MAX_WEATHER_BUFFER = 15;

export function computeImpact(
  route: Route | null,
  weather: WeatherData | null,
  settings: Settings,
  /** When the drive is expected to happen. */
  atMs: number,
): CommuteImpact {
  const trafficMinutes = route?.delayMinutes ?? null;

  if (!weather) {
    return {
      trafficMinutes,
      precipProbability: null,
      visibilityMiles: null,
      windGust: null,
      roadRisk: "low",
      weatherBufferMinutes: 0,
      factors: [],
      recommendation:
        "Weather data unavailable — no weather adjustment applied to the departure time.",
    };
  }

  const hour = nearestHour(weather, atMs);
  const precipProbability = hour?.precipProbability ?? weather.current.precipProbability;
  const visibilityMiles = hour?.visibilityMiles ?? weather.current.visibilityMiles;
  const windGust = hour?.windGust ?? weather.current.windGust;
  const code = hour?.conditionCode ?? weather.current.conditionCode;

  const factors: string[] = [];
  let points = 0;

  if (isFrozen(code)) {
    points += POINTS.frozen;
    factors.push(`${condition(code).label} forecast for the drive`);
  } else if (isWet(code) || (precipProbability ?? 0) >= 60) {
    const heavy = (precipProbability ?? 0) >= 70;
    points += heavy ? POINTS.heavyRain : POINTS.lightRain;
    factors.push(
      heavy
        ? `${Math.round(precipProbability ?? 0)}% chance of rain — wet roads likely`
        : `${Math.round(precipProbability ?? 0)}% chance of rain`,
    );
  }

  if (visibilityMiles !== null && visibilityMiles < 2) {
    points += POINTS.veryLowVisibility;
    factors.push(`Visibility around ${visibilityMiles.toFixed(1)} mi`);
  } else if (visibilityMiles !== null && visibilityMiles < 5) {
    points += POINTS.lowVisibility;
    factors.push(`Reduced visibility, around ${visibilityMiles.toFixed(1)} mi`);
  }

  if (windGust !== null && windGust >= 30) {
    points += POINTS.strongGust;
    factors.push(`Gusts to ${Math.round(windGust)} MPH`);
  }

  // A wet drive in the dark is worse than a wet drive at noon.
  const dark = hour ? !hour.isDay : false;
  if (dark && points > 0) {
    points += POINTS.darkness;
    factors.push("Drive falls outside daylight hours");
  }

  const roadRisk: RoadRisk = points >= 3 ? "high" : points >= 1 ? "moderate" : "low";
  const weatherBufferMinutes = Math.min(
    MAX_WEATHER_BUFFER,
    points * settings.weatherBufferMinutes,
  );

  return {
    trafficMinutes,
    precipProbability,
    visibilityMiles,
    windGust,
    roadRisk,
    weatherBufferMinutes,
    factors,
    recommendation: recommendFor(roadRisk, weatherBufferMinutes, trafficMinutes),
  };
}

function recommendFor(
  roadRisk: RoadRisk,
  weatherBuffer: number,
  trafficMinutes: number | null,
): string {
  const total = (trafficMinutes ?? 0) + weatherBuffer;
  if (roadRisk === "low" && (trafficMinutes === null || trafficMinutes < 3)) {
    return "No adjustment needed — normal departure time.";
  }
  if (roadRisk === "high") {
    return `Leave about ${Math.max(5, Math.round(total))} minutes early and expect slower going.`;
  }
  if (weatherBuffer > 0) {
    return `Leave about ${Math.round(total)} minutes early for weather and traffic.`;
  }
  return `Leave about ${Math.round(total)} minutes early for traffic.`;
}

/** The forecast hour containing `atMs`, or the closest one available. */
function nearestHour(weather: WeatherData, atMs: number): HourPoint | null {
  const hours = [...weather.recentHourly, ...weather.hourly];
  if (!hours.length) return null;

  let best = hours[0];
  let bestDistance = Math.abs(best.time - atMs);
  for (const hour of hours) {
    const distance = Math.abs(hour.time - atMs);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hour;
    }
  }
  return best;
}

export function computeDeparture(
  route: Route | null,
  impact: CommuteImpact,
  settings: Settings,
  now = Date.now(),
): DepartureRecommendation | null {
  if (!route) return null;

  const target = parseClock(settings.arrivalTime);
  if (target === null) return null;

  const arrivalAt = nextArrival(target, now);
  const driveMinutes = route.freeFlowMinutes ?? route.durationMinutes;
  // With a traffic-aware provider the delay is measured; without one there is
  // no traffic buffer to add, and the UI says the time is free-flow only.
  const trafficBufferMinutes = Math.max(0, Math.round(route.delayMinutes ?? 0));
  const weatherBufferMinutes = Math.round(impact.weatherBufferMinutes);
  const totalMinutes = Math.round(driveMinutes) + trafficBufferMinutes + weatherBufferMinutes;
  const departAt = arrivalAt - totalMinutes * 60_000;

  return {
    arrivalTarget: formatClock(target),
    arrivalAt,
    departAt,
    driveMinutes: Math.round(driveMinutes),
    trafficBufferMinutes,
    weatherBufferMinutes,
    totalMinutes,
    overdue: departAt < now,
  };
}

/**
 * The next occurrence of the target arrival time on a configured commute day.
 *
 * After the morning's arrival time has passed, the recommendation rolls
 * forward to the next commute day rather than showing a departure time in the
 * past all afternoon.
 */
function nextArrival(targetMinutes: number, now: number): number {
  const { minutesAfterMidnight, weekday } = localParts(new Date(now));
  const midnight = now - minutesAfterMidnight * 60_000;

  for (let offset = 0; offset < 8; offset += 1) {
    const day = (weekday + offset) % 7;
    const candidate = midnight + offset * 86_400_000 + targetMinutes * 60_000;
    // Allow the current day right up to the arrival time, plus a grace hour so
    // a late departure still shows what it should have been.
    if (candidate > now - 60 * 60_000) {
      void day;
      return candidate;
    }
  }

  return midnight + targetMinutes * 60_000;
}

/**
 * Whether now falls inside a commute window.
 *
 * Drives the tightened traffic refresh interval and the sticky commute card on
 * mobile. The morning window runs from two hours before the target arrival to
 * half an hour after it; the evening window is a fixed late-afternoon band.
 */
export function inCommuteWindow(settings: Settings, now = Date.now()): boolean {
  const { minutesAfterMidnight, weekday } = localParts(new Date(now));
  if (!settings.commuteDays.includes(weekday)) return false;

  const target = parseClock(settings.arrivalTime);
  if (target === null) return false;

  const morning = minutesAfterMidnight >= target - 120 && minutesAfterMidnight <= target + 30;
  const evening = minutesAfterMidnight >= 16 * 60 && minutesAfterMidnight <= 19 * 60;
  return morning || evening;
}

/** Exported for the settings screen, which explains the window in words. */
export function commuteWindowDescription(settings: Settings): string {
  const target = parseClock(settings.arrivalTime);
  const morning =
    target === null
      ? "two hours before your arrival time"
      : `${formatClock(target - 120)} – ${formatClock(target + 30)}`;
  return `${morning} and 4:00 PM – 7:00 PM (${TIME_ZONE.split("/")[1].replace("_", " ")})`;
}
