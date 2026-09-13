import { defaultSettings, type Settings } from "../config";
import { localParts } from "../format";
import { activeAlerts, collectAlerts, countBySeverity, overridingAlerts } from "../alerts/engine";
import { getCommute, getRoads } from "../routing/service";
import { getPublicSafety } from "../sources/service";
import {
  getAirQuality,
  getRadar,
  getWeather,
  getWeatherAlerts,
} from "../weather/service";
import { buildBriefing, type Briefing } from "./briefing";
import { computeDayStatus } from "./dayStatus";
import {
  computeWhatChanged,
  type DashboardSnapshot,
  type WhatChanged,
} from "./snapshot";
import type { AirQualityData, RadarData, WeatherAlert, WeatherData } from "../weather/types";
import type { CommuteData } from "../routing/types";
import type { RoadsData } from "../traffic/types";
import type { PublicSafetyData } from "../sources/types";
import type { Alert, AlertSeverity, DayStatus, ModuleSnapshot } from "@/types";

/**
 * The Command Center aggregate: every module, assembled into one answer.
 *
 * This is the file that makes the dashboard an intelligence system rather than
 * a page of widgets. The modules do not know about each other — weather has no
 * idea a commute exists — and all of the cross-module reasoning happens here:
 * the commute is scored with the forecast for the hour of the drive, the day
 * status weighs traffic against alerts against air quality, the briefing reads
 * from every module's own summary, and "what changed" diffs the whole picture
 * against the last time it was assembled.
 *
 * Adding a module means fetching it alongside the others and handing it to
 * these four functions. Nothing here is shaped around any particular module.
 */

export type ModuleHealth = {
  id: string;
  label: string;
  state: ModuleSnapshot<unknown>["status"]["state"];
  message?: string;
  lastSuccessAt?: number;
  timestamp: number;
};

export type CommandCenterData = {
  generatedAt: number;
  emphasis: "workday" | "weekend";
  briefing: Briefing;
  dayStatus: DayStatus;
  whatChanged: WhatChanged;
  /** Returned so the client can store it and diff against it next visit. */
  snapshot: DashboardSnapshot;
  alerts: Alert[];
  /** Critical alerts, which the Today page hoists above everything else. */
  overriding: Alert[];
  alertCounts: Record<AlertSeverity, number>;
  weather: ModuleSnapshot<WeatherData>;
  weatherAlerts: ModuleSnapshot<WeatherAlert[]>;
  airQuality: ModuleSnapshot<AirQualityData>;
  commute: ModuleSnapshot<CommuteData>;
  roads: ModuleSnapshot<RoadsData>;
  publicSafety: ModuleSnapshot<PublicSafetyData>;
  radar: ModuleSnapshot<RadarData>;
  /** Per-module state for the status strip. */
  system: ModuleHealth[];
};

export type CommandCenterRequest = {
  settings?: Settings;
  authorized: boolean;
  clientSnapshot?: DashboardSnapshot | null;
  /**
   * Trims the weather series to what the Today page draws. The dedicated
   * Weather pages ask for the full set instead, which keeps the first paint
   * small without making any screen fetch twice.
   */
  trimSeries?: boolean;
};

export async function getCommandCenter(
  request: CommandCenterRequest,
): Promise<CommandCenterData> {
  const settings = request.settings ?? defaultSettings();

  // Weather first, because the commute needs the forecast for the drive window
  // to compute its impact and buffers. Everything else is independent, so it
  // all goes out at once.
  const [weather, weatherAlerts, airQuality, publicSafety, radar] = await Promise.all([
    getWeather(),
    getWeatherAlerts(),
    getAirQuality(),
    getPublicSafety(settings.disabledSources ?? []),
    getRadar(),
  ]);

  const commute = await getCommute({
    settings,
    authorized: request.authorized,
    weather: weather.data,
  });

  const roads = await getRoads(commute.data?.routes ?? [], request.authorized);

  const emphasis = resolveEmphasis(settings);

  const dayStatus = computeDayStatus({
    weather,
    weatherAlerts,
    airQuality,
    commute,
    roads,
    publicSafety,
  });

  const briefing = buildBriefing({
    weather,
    weatherAlerts,
    airQuality,
    commute,
    publicSafety,
    emphasis,
  });

  const { whatChanged, snapshot } = computeWhatChanged({
    weather,
    weatherAlerts,
    airQuality,
    commute,
    publicSafety,
    clientSnapshot: request.clientSnapshot,
  });

  const snapshots = [
    weather,
    weatherAlerts,
    airQuality,
    commute,
    roads,
    publicSafety,
    radar,
  ];
  const alerts = activeAlerts(collectAlerts(snapshots));

  return {
    generatedAt: Date.now(),
    emphasis,
    briefing,
    dayStatus,
    whatChanged,
    snapshot,
    alerts,
    overriding: overridingAlerts(alerts),
    alertCounts: countBySeverity(alerts),
    weather: request.trimSeries ? trimWeather(weather) : weather,
    weatherAlerts,
    airQuality,
    commute,
    roads,
    publicSafety,
    radar,
    system: snapshots.map(health),
  };
}

function health(snapshot: ModuleSnapshot<unknown>): ModuleHealth {
  return {
    id: snapshot.id,
    label: snapshot.label,
    state: snapshot.status.state,
    message: snapshot.status.message,
    lastSuccessAt: snapshot.status.lastSuccessAt,
    timestamp: snapshot.timestamp,
  };
}

/**
 * Workday or weekend emphasis.
 *
 * "auto" follows the configured commute days, so someone who works Tuesday to
 * Saturday gets a workday dashboard on Saturday and a weekend one on Monday.
 */
function resolveEmphasis(settings: Settings): "workday" | "weekend" {
  if (settings.emphasis !== "auto") return settings.emphasis;
  const { weekday } = localParts();
  return settings.commuteDays.includes(weekday) ? "workday" : "weekend";
}

/**
 * Cuts the weather series down to what Today actually renders.
 *
 * The full payload carries eleven days of hourly data for the forecast charts;
 * Today draws the next six hours, a 24-hour trend and a pressure history. Sending
 * the rest would be the largest thing on the page for no visible benefit.
 */
function trimWeather(snapshot: ModuleSnapshot<WeatherData>): ModuleSnapshot<WeatherData> {
  const data = snapshot.data;
  if (!data) return snapshot;

  const now = data.current.observedAt;
  const forwardCutoff = now + 30 * 3_600_000;
  const historyCutoff = now - 26 * 3_600_000;

  return {
    ...snapshot,
    data: {
      ...data,
      hourly: data.hourly.filter((hour) => hour.time <= forwardCutoff),
      recentHourly: data.recentHourly.filter((hour) => hour.time >= historyCutoff),
      daily: data.daily.slice(0, 11),
      pressure: {
        ...data.pressure,
        history: data.pressure.history.filter((point) => point.time >= historyCutoff),
      },
    },
  };
}
