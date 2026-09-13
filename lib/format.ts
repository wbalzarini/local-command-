import type { StatusLevel, TrendDirection } from "@/types";
import { DEFAULT_SETTINGS, type Settings } from "./config";

/**
 * The dashboard is about one place, so every clock on it runs on that place's
 * time. Formatting anything in the server's timezone would put the commute
 * window an hour out whenever Vercel runs the route in UTC.
 */
export const TIME_ZONE = "America/New_York";

const HPA_PER_INHG = 33.863886666667;

export function hpaToInHg(hpa: number): number {
  return hpa / HPA_PER_INHG;
}

export function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

export function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

/** Canonical server units are °F, mph, inHg and miles; these convert for display. */
export function displayTemp(
  fahrenheit: number,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): number {
  return units.temperature === "C" ? fToC(fahrenheit) : fahrenheit;
}

export function displayWind(
  mph: number,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): number {
  if (units.wind === "kph") return mph * 1.609344;
  if (units.wind === "kn") return mph * 0.868976;
  return mph;
}

export function displayPressure(
  inHg: number,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): number {
  // hPa and mb are the same quantity under two names.
  return units.pressure === "inHg" ? inHg : inHg * HPA_PER_INHG;
}

export function displayDistance(
  miles: number,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): number {
  return units.distance === "km" ? miles * 1.609344 : miles;
}

export function temperatureUnitLabel(units: Settings["units"]): string {
  return units.temperature === "C" ? "°C" : "°";
}

export function pressureDecimals(units: Settings["units"]): number {
  return units.pressure === "inHg" ? 2 : 1;
}

export function formatTemp(
  fahrenheit: number | null | undefined,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): string {
  if (fahrenheit === null || fahrenheit === undefined) return "—";
  return `${Math.round(displayTemp(fahrenheit, units))}°`;
}

export function formatWind(
  mph: number | null | undefined,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): string {
  if (mph === null || mph === undefined) return "—";
  return `${Math.round(displayWind(mph, units))} ${units.wind.toUpperCase()}`;
}

export function formatPressure(
  inHg: number | null | undefined,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): string {
  if (inHg === null || inHg === undefined) return "—";
  const value = displayPressure(inHg, units);
  return `${value.toFixed(pressureDecimals(units))} ${units.pressure}`;
}

/** Signed, for pressure change readouts where the sign carries the meaning. */
export function formatPressureDelta(
  inHg: number | null | undefined,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): string {
  if (inHg === null || inHg === undefined) return "—";
  const value = displayPressure(inHg, units);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(pressureDecimals(units))} ${units.pressure}`;
}

export function formatDistance(
  miles: number | null | undefined,
  units: Settings["units"] = DEFAULT_SETTINGS.units,
): string {
  if (miles === null || miles === undefined) return "—";
  return `${displayDistance(miles, units).toFixed(1)} ${units.distance}`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatDelta(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const rounded = Math.round(minutes);
  if (rounded === 0) return "on time";
  return rounded > 0 ? `+${rounded} min` : `−${Math.abs(rounded)} min`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function formatInches(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(2)}"`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
});

export function formatTime(value: number | string | Date | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

export function formatHour(value: number | string | Date): string {
  const date = toDate(value);
  return date ? hourFormatter.format(date) : "—";
}

export function formatLongDay(value: number | string | Date): string {
  const date = toDate(value);
  return date ? dayFormatter.format(date) : "—";
}

export function formatShortDay(value: number | string | Date): string {
  const date = toDate(value);
  return date ? shortDayFormatter.format(date) : "—";
}

export function formatShortDate(value: number | string | Date): string {
  const date = toDate(value);
  return date ? shortDateFormatter.format(date) : "—";
}

function toDate(value: number | string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "4 min ago" — used on every module's last-updated line. */
export function formatAgo(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp) return "never";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function compass(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined) return "—";
  return COMPASS[Math.round(((degrees % 360) / 22.5)) % 16];
}

export const TREND_LABEL: Record<TrendDirection, string> = {
  "rapidly-rising": "RAPIDLY RISING",
  rising: "RISING",
  steady: "STEADY",
  falling: "FALLING",
  "rapidly-falling": "RAPIDLY FALLING",
};

export const TREND_ARROW: Record<TrendDirection, string> = {
  "rapidly-rising": "⇑",
  rising: "↑",
  steady: "→",
  falling: "↓",
  "rapidly-falling": "⇓",
};

export const STATUS_LABEL: Record<StatusLevel, string> = {
  good: "GOOD",
  moderate: "MODERATE",
  poor: "POOR",
  severe: "SEVERE",
  unknown: "UNKNOWN",
};

/** Parses "07:45" into minutes after local midnight. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Renders minutes-after-midnight back as "7:45 AM". */
export function formatClock(minutesAfterMidnight: number): string {
  const total = ((minutesAfterMidnight % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** Local wall-clock parts for the configured timezone, wherever this runs. */
export function localParts(at = new Date()): {
  minutesAfterMidnight: number;
  weekday: number;
  hour: number;
  dateKey: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    minutesAfterMidnight: hour * 60 + minute,
    weekday: Math.max(0, weekdays.indexOf(get("weekday"))),
    hour,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}
