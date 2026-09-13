/**
 * WMO weather interpretation codes.
 *
 * Open-Meteo reports conditions as WMO codes rather than provider-specific
 * strings, which is convenient: the mapping below is the only place in the app
 * that turns a code into words or a glyph, so a second provider only has to
 * produce a WMO code to render identically.
 */

export type ConditionInfo = {
  label: string;
  /** Short form for the hourly strip, where horizontal space is scarce. */
  short: string;
  /** Coarse family, used for icon choice and for the "is it wet" question. */
  family: "clear" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";
};

const CODES: Record<number, ConditionInfo> = {
  0: { label: "Clear", short: "Clear", family: "clear" },
  1: { label: "Mainly Clear", short: "M Clear", family: "clear" },
  2: { label: "Partly Cloudy", short: "P Cloudy", family: "cloud" },
  3: { label: "Overcast", short: "Overcast", family: "cloud" },
  45: { label: "Fog", short: "Fog", family: "fog" },
  48: { label: "Freezing Fog", short: "Frz Fog", family: "fog" },
  51: { label: "Light Drizzle", short: "Drizzle", family: "drizzle" },
  53: { label: "Drizzle", short: "Drizzle", family: "drizzle" },
  55: { label: "Heavy Drizzle", short: "Drizzle", family: "drizzle" },
  56: { label: "Freezing Drizzle", short: "Frz Driz", family: "drizzle" },
  57: { label: "Freezing Drizzle", short: "Frz Driz", family: "drizzle" },
  61: { label: "Light Rain", short: "Lt Rain", family: "rain" },
  63: { label: "Rain", short: "Rain", family: "rain" },
  65: { label: "Heavy Rain", short: "Hvy Rain", family: "rain" },
  66: { label: "Freezing Rain", short: "Frz Rain", family: "rain" },
  67: { label: "Freezing Rain", short: "Frz Rain", family: "rain" },
  71: { label: "Light Snow", short: "Lt Snow", family: "snow" },
  73: { label: "Snow", short: "Snow", family: "snow" },
  75: { label: "Heavy Snow", short: "Hvy Snow", family: "snow" },
  77: { label: "Snow Grains", short: "Snow", family: "snow" },
  80: { label: "Rain Showers", short: "Showers", family: "rain" },
  81: { label: "Rain Showers", short: "Showers", family: "rain" },
  82: { label: "Violent Rain Showers", short: "Showers", family: "rain" },
  85: { label: "Snow Showers", short: "Sn Show", family: "snow" },
  86: { label: "Heavy Snow Showers", short: "Sn Show", family: "snow" },
  95: { label: "Thunderstorm", short: "Storms", family: "storm" },
  96: { label: "Thunderstorm with Hail", short: "Storms", family: "storm" },
  99: { label: "Severe Thunderstorm with Hail", short: "Storms", family: "storm" },
};

const UNKNOWN: ConditionInfo = { label: "Unknown", short: "—", family: "cloud" };

export function condition(code: number | null | undefined): ConditionInfo {
  if (code === null || code === undefined) return UNKNOWN;
  return CODES[code] ?? UNKNOWN;
}

/** Precipitating conditions, for the commute wet-road calculation. */
export function isWet(code: number): boolean {
  const family = condition(code).family;
  return family === "rain" || family === "snow" || family === "drizzle" || family === "storm";
}

export function isFrozen(code: number): boolean {
  const family = condition(code).family;
  if (family === "snow") return true;
  return code === 56 || code === 57 || code === 66 || code === 67 || code === 48;
}
