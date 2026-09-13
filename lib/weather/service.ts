import { cached, lastSuccessAt } from "../cache";
import { REFRESH, weatherLocation } from "../config";
import { env } from "../env";
import { formatTime } from "../format";
import { condition } from "./conditions";
import { demoAirQuality, DEMO_SOURCE, demoWeather } from "./demo";
import { fetchAirQuality, AIR_QUALITY_SOURCE } from "./airQuality";
import { fetchHistory, ARCHIVE_SOURCE, RECENT_SOURCE, type TodayValues } from "./history";
import { fetchNwsAlerts, NWS_SOURCE } from "./nws";
import { BASEMAP_SOURCE, fetchRadar, RADAR_SOURCE } from "./radar";
import { fetchOpenMeteo } from "./openMeteo";
import { weatherChangeAlerts } from "../alerts/weather";
import type {
  AirQualityData,
  HistoryRange,
  HistorySeries,
  RadarData,
  WeatherAlert,
  WeatherData,
} from "./types";
import type { ModuleSnapshot, ModuleStatus, SourceRef } from "@/types";

/**
 * The weather service. Screens and API routes read weather only through here.
 *
 * Each getter follows the same shape: ask the cache, which asks the provider at
 * most once per refresh interval; on failure fall back to the last good value
 * and mark it stale; if there has never been a good value, report the module
 * unavailable. Demo data appears only when DEMO_MODE is set, never as a silent
 * substitute for a failed call — the whole point of the `state` field is that
 * the UI can tell the difference and say so.
 */

const PROVIDER_SOURCE: SourceRef = {
  name: "Open-Meteo",
  kind: "provider",
  url: "https://open-meteo.com/",
};

export async function getWeather(): Promise<ModuleSnapshot<WeatherData>> {
  const point = weatherLocation();
  const key = `weather:${point.lat},${point.lon}`;

  if (env.demoMode()) {
    const data = demoWeather();
    return {
      id: "weather",
      label: "Weather",
      data,
      status: { state: "demo", message: "Sample data — no provider configured", lastSuccessAt: Date.now() },
      timestamp: Date.now(),
      sources: [DEMO_SOURCE],
      alerts: weatherChangeAlerts(data, DEMO_SOURCE),
      summary: summariseWeather(data),
    };
  }

  const result = await cached<WeatherData>(key, REFRESH.weather, async () => {
    const response = await fetchOpenMeteo(point);
    return response.ok ? response.data : null;
  });

  if (!result) {
    return {
      id: "weather",
      label: "Weather",
      data: null,
      status: {
        state: "unavailable",
        message: "Weather data temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [PROVIDER_SOURCE],
      alerts: [],
      summary: "Weather data is unavailable.",
    };
  }

  return {
    id: "weather",
    label: "Weather",
    data: result.value,
    status: staleAware(result.stale, result.storedAt, "Weather"),
    timestamp: result.storedAt,
    sources: [{ ...PROVIDER_SOURCE, fetchedAt: result.storedAt }],
    alerts: weatherChangeAlerts(result.value, PROVIDER_SOURCE),
    summary: summariseWeather(result.value),
  };
}

export async function getWeatherAlerts(): Promise<ModuleSnapshot<WeatherAlert[]>> {
  const point = weatherLocation();
  const key = `nws-alerts:${point.lat},${point.lon}`;

  if (env.demoMode()) {
    // No fabricated warnings. An invented tornado warning in a screenshot is
    // the one piece of sample data that could actually hurt someone.
    return {
      id: "weather-alerts",
      label: "Severe Weather",
      data: [],
      status: { state: "demo", message: "Sample mode — official alerts are never simulated", lastSuccessAt: Date.now() },
      timestamp: Date.now(),
      sources: [DEMO_SOURCE],
      alerts: [],
      summary: "No active alerts in sample mode. Official alerts are never simulated.",
    };
  }

  const result = await cached<WeatherAlert[]>(key, REFRESH.alerts, async () => {
    const response = await fetchNwsAlerts(point);
    return response.ok ? response.alerts : null;
  });

  if (!result) {
    return {
      id: "weather-alerts",
      label: "Severe Weather",
      data: null,
      status: {
        state: "unavailable",
        message: "Alert feed temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [NWS_SOURCE],
      alerts: [],
      // Not "there are no alerts" — we could not ask.
      summary: "Could not reach the National Weather Service alert feed.",
    };
  }

  const alerts = result.value;

  return {
    id: "weather-alerts",
    label: "Severe Weather",
    data: alerts,
    status: staleAware(result.stale, result.storedAt, "Alert feed"),
    timestamp: result.storedAt,
    sources: [{ ...NWS_SOURCE, fetchedAt: result.storedAt }],
    alerts,
    summary: alerts.length
      ? `${alerts.length} active NWS ${alerts.length === 1 ? "alert" : "alerts"}: ${alerts.map((alert) => alert.event).join(", ")}.`
      : "No active National Weather Service alerts for this location.",
  };
}

export async function getAirQuality(): Promise<ModuleSnapshot<AirQualityData>> {
  const point = weatherLocation();
  const key = `air-quality:${point.lat},${point.lon}`;

  if (env.demoMode()) {
    const data = demoAirQuality();
    return {
      id: "air-quality",
      label: "Air Quality",
      data,
      status: { state: "demo", message: "Sample data", lastSuccessAt: Date.now() },
      timestamp: Date.now(),
      sources: [DEMO_SOURCE],
      alerts: [],
      summary: data.summary,
    };
  }

  const result = await cached<AirQualityData>(key, REFRESH.airQuality, async () => {
    const response = await fetchAirQuality(point);
    return response.ok ? response.data : null;
  });

  if (!result) {
    return {
      id: "air-quality",
      label: "Air Quality",
      data: null,
      status: {
        state: "unavailable",
        message: "Air quality data temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [AIR_QUALITY_SOURCE],
      alerts: [],
      summary: "Air quality data is unavailable.",
    };
  }

  const data = result.value;
  const alerts =
    data.aqi !== null && data.aqi > 100
      ? [
          {
            id: `air-quality-${Math.round(data.aqi)}`,
            module: "air-quality",
            category: "air-quality" as const,
            severity: (data.aqi > 150 ? "important" : "advisory") as "important" | "advisory",
            priority: 4 as const,
            title: `Air quality ${data.label.toLowerCase()} — AQI ${Math.round(data.aqi)}`,
            body: data.summary,
            issuedAt: data.observedAt,
            source: AIR_QUALITY_SOURCE,
          },
        ]
      : [];

  return {
    id: "air-quality",
    label: "Air Quality",
    data,
    status: staleAware(result.stale, result.storedAt, "Air quality"),
    timestamp: result.storedAt,
    sources: [{ ...AIR_QUALITY_SOURCE, fetchedAt: result.storedAt }],
    alerts,
    summary: data.summary,
  };
}

export async function getRadar(): Promise<ModuleSnapshot<RadarData>> {
  const key = "radar:index";

  if (env.demoMode()) {
    // Radar is imagery: there is nothing honest to simulate, so sample mode
    // reports the module as unavailable rather than drawing fake echoes.
    return {
      id: "radar",
      label: "Radar",
      data: null,
      status: { state: "demo", message: "Radar imagery is not simulated in sample mode." },
      timestamp: Date.now(),
      sources: [DEMO_SOURCE],
      alerts: [],
      summary: "Radar imagery is not simulated in sample mode.",
    };
  }

  const result = await cached<RadarData>(key, REFRESH.radar, async () => {
    const response = await fetchRadar();
    return response.ok ? response.data : null;
  });

  if (!result) {
    return {
      id: "radar",
      label: "Radar",
      data: null,
      status: {
        state: "unavailable",
        message: "Radar imagery temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [RADAR_SOURCE, BASEMAP_SOURCE],
      alerts: [],
      summary: "Radar imagery is unavailable.",
    };
  }

  const latest = result.value.frames.filter((frame) => frame.past).at(-1);

  return {
    id: "radar",
    label: "Radar",
    data: result.value,
    status: staleAware(result.stale, result.storedAt, "Radar"),
    timestamp: result.storedAt,
    sources: [
      { ...RADAR_SOURCE, fetchedAt: result.storedAt },
      BASEMAP_SOURCE,
    ],
    alerts: [],
    summary: latest
      ? `${result.value.frames.length} radar frames available, latest ${formatTime(latest.time)}.`
      : `${result.value.frames.length} radar frames available.`,
  };
}

export async function getWeatherHistory(
  range: HistoryRange,
  today: TodayValues,
): Promise<ModuleSnapshot<HistorySeries>> {
  const point = weatherLocation();
  const key = `history:${range}:${point.lat},${point.lon}`;

  const result = await cached<HistorySeries>(key, REFRESH.history, async () => {
    const response = await fetchHistory(point, range, today);
    return response.ok ? response.data : null;
  });

  if (!result) {
    return {
      id: "weather-history",
      label: "History",
      data: null,
      status: {
        state: "unavailable",
        message: "Historical data temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [range === "1y" ? ARCHIVE_SOURCE : RECENT_SOURCE],
      alerts: [],
      summary: "Historical data is unavailable.",
    };
  }

  return {
    id: "weather-history",
    label: "History",
    data: result.value,
    status: staleAware(result.stale, result.storedAt, "History"),
    timestamp: result.storedAt,
    sources: result.value.sources,
    alerts: [],
    summary: `${result.value.points.length} observations over the last ${range}.`,
  };
}

/**
 * One sentence describing the weather, built only from values that are present.
 *
 * The daily briefing quotes this rather than re-deriving it, so there is one
 * place where weather turns into words and one place to check that it never
 * says more than the data supports.
 */
function summariseWeather(data: WeatherData): string {
  const { current, hourly, pressure } = data;
  const parts = [
    `${Math.round(current.temperature)}° and ${condition(current.conditionCode).label.toLowerCase()}`,
    `high ${Math.round(current.high)}°, low ${Math.round(current.low)}°`,
  ];

  if (pressure.trend.direction !== "steady") {
    parts.push(`pressure ${pressure.trend.direction.replace("-", " ")}`);
  }

  const wettest = hourly
    .filter((hour) => hour.time <= current.observedAt + 12 * 3_600_000)
    .reduce<{ time: number; probability: number } | null>((best, hour) => {
      const probability = hour.precipProbability;
      if (probability === null) return best;
      if (!best || probability > best.probability) return { time: hour.time, probability };
      return best;
    }, null);

  if (wettest && wettest.probability >= 40) {
    parts.push(`rain chances reach ${Math.round(wettest.probability)}% around ${formatTime(wettest.time)}`);
  }

  return `${parts.join(", ")}.`;
}

/** Shared status builder: real data that missed its refresh window is stale, not broken. */
function staleAware(stale: boolean, storedAt: number, label: string): ModuleStatus {
  return stale
    ? {
        state: "stale",
        message: `${label} data could not be refreshed — showing the last successful update.`,
        lastSuccessAt: storedAt,
      }
    : { state: "ok", lastSuccessAt: storedAt };
}
