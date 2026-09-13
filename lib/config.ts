import { env } from "./env";
import type { NamedPlace } from "@/types";

/**
 * Default location: Avondale, Pennsylvania 19311.
 *
 * Deliberately the borough centroid rather than the exact street address. The
 * weather for a house and for its town are the same to three decimal places,
 * so storing the doorstep would buy nothing and leak something.
 */
export const AVONDALE: NamedPlace = {
  lat: 39.8237,
  lon: -75.7827,
  label: "Avondale, PA",
};

/** Primary weather location. */
export function weatherLocation(): NamedPlace {
  const lat = env.homeLat();
  const lon = env.homeLon();
  if (lat !== undefined && lon !== undefined) {
    return { lat, lon, label: env.homeLabel() ?? AVONDALE.label };
  }
  return AVONDALE;
}

/**
 * Commute origin. Marked private: the address is read on the server to build a
 * route and is never included in an API response.
 */
export function homePlace(): NamedPlace {
  const lat = env.homeLat() ?? AVONDALE.lat;
  const lon = env.homeLon() ?? AVONDALE.lon;
  return {
    lat,
    lon,
    label: env.homeLabel() ?? "Home",
    address: env.homeAddress(),
    private: true,
  };
}

/**
 * Commute destination: JPMorgan Chase, 500 Stein Christiana Road, Newark, DE
 * 19713. Coordinates are a fallback; the geocoder refines them when reachable.
 */
export function workPlace(): NamedPlace {
  const lat = env.workLat() ?? 39.6823;
  const lon = env.workLon() ?? -75.6177;
  return {
    lat,
    lon,
    label: env.workLabel() ?? "JPMorgan Chase — Newark, DE",
    address:
      env.workAddress() ?? "500 Stein Christiana Road, Newark, DE 19713",
  };
}

/** County monitored for publicly announced checkpoints. */
export const PUBLIC_SAFETY_AREA = {
  county: "Chester County",
  state: "PA",
  stateName: "Pennsylvania",
} as const;

/**
 * Refresh intervals, in seconds.
 *
 * These bound provider calls, not just UI polling: each API route caches for
 * its interval so a browser left open overnight cannot run the app past a
 * provider's rate limit.
 */
export const REFRESH = {
  /** Open-Meteo asks for 15 minutes between calls for the same point. */
  weather: 10 * 60,
  /** NWS alerts change fast when they change at all. */
  alerts: 5 * 60,
  airQuality: 30 * 60,
  /** RainViewer publishes a new frame roughly every 10 minutes. */
  radar: 5 * 60,
  /** Tightened during the commute window, see `commuteRefresh`. */
  traffic: 5 * 60,
  trafficCommuteWindow: 60,
  roads: 10 * 60,
  /** Police and county sites post rarely; hammering them is rude and pointless. */
  publicSafety: 30 * 60,
  history: 60 * 60,
} as const;

/** Traffic refresh depends on whether we are inside a commute window. */
export function commuteRefresh(inWindow: boolean): number {
  return inWindow ? REFRESH.trafficCommuteWindow : REFRESH.traffic;
}

/** Defaults for anything the user can change in Settings. */
export const DEFAULT_SETTINGS = {
  arrivalTime: "08:00",
  /** Monday–Friday. 0 = Sunday. */
  commuteDays: [1, 2, 3, 4, 5],
  /** Minutes of delay before the traffic engine raises an alert. */
  trafficThresholdMinutes: 10,
  /** Extra minutes to add when the drive will be wet, dark or windy. */
  weatherBufferMinutes: 3,
  /** An alternate must beat the primary by this much before it is recommended. */
  alternateThresholdMinutes: 5,
  units: {
    temperature: "F" as "F" | "C",
    wind: "mph" as "mph" | "kph" | "kn",
    pressure: "inHg" as "inHg" | "hPa" | "mb",
    distance: "mi" as "mi" | "km",
  },
  /** Which categories may raise a notification. */
  notifications: {
    severeWeather: true,
    weatherChange: true,
    traffic: true,
    roads: true,
    publicSafety: true,
  },
  /** "auto" follows the calendar; the others pin the emphasis. */
  emphasis: "auto" as "auto" | "workday" | "weekend",
} as const;

/** A fresh, mutable copy of the defaults. */
export function defaultSettings(): Settings {
  return {
    arrivalTime: DEFAULT_SETTINGS.arrivalTime,
    commuteDays: [...DEFAULT_SETTINGS.commuteDays],
    trafficThresholdMinutes: DEFAULT_SETTINGS.trafficThresholdMinutes,
    weatherBufferMinutes: DEFAULT_SETTINGS.weatherBufferMinutes,
    alternateThresholdMinutes: DEFAULT_SETTINGS.alternateThresholdMinutes,
    units: { ...DEFAULT_SETTINGS.units },
    notifications: { ...DEFAULT_SETTINGS.notifications },
    emphasis: DEFAULT_SETTINGS.emphasis,
    disabledSources: [],
  };
}

export type Settings = {
  arrivalTime: string;
  commuteDays: number[];
  trafficThresholdMinutes: number;
  weatherBufferMinutes: number;
  alternateThresholdMinutes: number;
  units: {
    temperature: "F" | "C";
    wind: "mph" | "kph" | "kn";
    pressure: "inHg" | "hPa" | "mb";
    distance: "mi" | "km";
  };
  notifications: {
    severeWeather: boolean;
    weatherChange: boolean;
    traffic: boolean;
    roads: boolean;
    publicSafety: boolean;
  };
  emphasis: "auto" | "workday" | "weekend";
  /** Source ids the user has switched off, from the source registry. */
  disabledSources?: string[];
};
