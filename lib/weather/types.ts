import type { Alert, SourceRef, Trend } from "@/types";

/**
 * Canonical weather units inside the app: °F, mph, inHg, miles, inches.
 *
 * Providers are normalised to these at the edge so no component ever has to
 * ask which provider a number came from to know what it means. Settings then
 * convert for display only.
 */

export type CurrentConditions = {
  observedAt: number;
  temperature: number;
  feelsLike: number;
  /** WMO weather interpretation code. */
  conditionCode: number;
  condition: string;
  isDay: boolean;
  high: number;
  low: number;
  humidity: number;
  dewPoint: number | null;
  windSpeed: number;
  windDirection: number;
  windGust: number | null;
  visibilityMiles: number | null;
  /** Precipitation in the last hour, inches. */
  precipitation: number;
  precipProbability: number | null;
  pressureInHg: number;
  cloudCover: number;
  uvIndex: number | null;
  sunrise: number;
  sunset: number;
};

export type HourPoint = {
  time: number;
  temperature: number;
  feelsLike: number | null;
  humidity: number | null;
  dewPoint: number | null;
  precipProbability: number | null;
  precipitation: number | null;
  conditionCode: number;
  pressureInHg: number | null;
  cloudCover: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  visibilityMiles: number | null;
  uvIndex: number | null;
  isDay: boolean;
};

export type DayPoint = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  time: number;
  conditionCode: number;
  condition: string;
  high: number;
  low: number;
  precipProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  sunrise: number;
  sunset: number;
  daylightSeconds: number | null;
  uvIndexMax: number | null;
  /** Mean sea-level pressure for the day, averaged from hourly values. */
  pressureInHg: number | null;
};

export type PressurePoint = { time: number; pressureInHg: number };

export type PressureReading = {
  currentInHg: number;
  /** Signed change over each window, inHg. Null when history is too short. */
  change3h: number | null;
  change6h: number | null;
  change12h: number | null;
  change24h: number | null;
  trend: Trend;
  /** Plain-language reading of the trend. Never a forecast claim. */
  interpretation: string;
  history: PressurePoint[];
};

export type MetricTrend = {
  key: string;
  label: string;
  /** Signed change across the window. */
  change: number;
  unit: string;
  /** Rendered value, already unit-aware for canonical units. */
  direction: "up" | "down" | "flat";
  /** True when this change is big enough to matter. Drives visual emphasis. */
  notable: boolean;
};

export type WeatherTrends = {
  windowHours: number;
  metrics: MetricTrend[];
  interpretation: string;
};

export type Daylight = {
  sunrise: number;
  sunset: number;
  daylightSeconds: number;
  remainingSeconds: number;
  /** Golden hour around sunset, only when the sun actually sets that day. */
  goldenHourStart: number | null;
  goldenHourEnd: number | null;
};

export type WeatherData = {
  current: CurrentConditions;
  /** Forward-looking hours, starting with the current hour. */
  hourly: HourPoint[];
  /** Hours already past, used by trends, pressure history and "what changed". */
  recentHourly: HourPoint[];
  daily: DayPoint[];
  pressure: PressureReading;
  trends: WeatherTrends;
  daylight: Daylight;
  /** Yesterday's numbers, for the day-over-day comparison. */
  yesterday: { high: number; low: number; precipitation: number | null } | null;
};

export type AirQualityData = {
  observedAt: number;
  /** U.S. EPA AQI. */
  aqi: number | null;
  category: "good" | "moderate" | "unhealthy-sensitive" | "unhealthy" | "very-unhealthy" | "hazardous" | "unknown";
  label: string;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  /** Aerosol optical depth stands in for smoke; labelled as such in the UI. */
  smokeIndex: number | null;
  /** Open-Meteo only publishes pollen for Europe, so this is usually null. */
  pollen: { alder: number | null; birch: number | null; grass: number | null; ragweed: number | null } | null;
  summary: string;
};

export type WeatherAlert = Alert & {
  /** NWS event name, e.g. "Severe Thunderstorm Warning". */
  event: string;
  /** NWS severity vocabulary. */
  nwsSeverity?: string;
  certainty?: string;
  urgency?: string;
  instruction?: string;
  /** GeoJSON polygon, when the alert carries one, for the radar overlay. */
  geometry?: unknown;
};

export type RadarFrame = {
  /** Unix seconds of the frame. */
  time: number;
  /** Tile URL template with {z}/{x}/{y} placeholders. */
  urlTemplate: string;
  past: boolean;
};

export type RadarData = {
  frames: RadarFrame[];
  /** Host serving the tiles, needed for attribution. */
  host: string;
  generatedAt: number;
  /** Provider-recommended seconds between refreshes. */
  refreshSeconds: number;
  /** True when the provider also publishes forecast (nowcast) frames. */
  hasNowcast: boolean;
  /** Satellite infrared frames, when published. */
  satelliteFrames: RadarFrame[];
};

export type HistoryRange = "24h" | "7d" | "30d" | "1y";

export type HistorySeries = {
  range: HistoryRange;
  points: {
    time: number;
    temperature: number | null;
    temperatureMax?: number | null;
    temperatureMin?: number | null;
    pressureInHg: number | null;
    precipitation: number | null;
    windSpeed: number | null;
  }[];
  /** Today measured against the same period in the recent climate record. */
  normals: {
    temperature: { today: number | null; normal: number | null; delta: number | null };
    precipitation: { today: number | null; normal: number | null; delta: number | null };
    wind: { today: number | null; normal: number | null; delta: number | null };
    /** Years of record the normal was averaged over. */
    basisYears: number;
  } | null;
  sources: SourceRef[];
};
