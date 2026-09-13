import { formatAgo } from "../format";
import type { AirQualityData, WeatherAlert, WeatherData } from "../weather/types";
import type { CommuteData } from "../routing/types";
import type { PublicSafetyData } from "../sources/types";
import type { ModuleSnapshot } from "@/types";

/**
 * "What Changed?" — the intelligence module.
 *
 * Three comparisons, because "changed" means three different things:
 *
 *  - against yesterday, for temperature and rainfall;
 *  - against the previous forecast, for values the model has revised;
 *  - against the previous dashboard refresh, for traffic and new alerts.
 *
 * Each candidate change carries a magnitude, and the list is sorted by it and
 * truncated, so what surfaces is what actually matters rather than every field
 * that moved by a decimal. A one-degree revision is a change; it is not news.
 *
 * The previous snapshot is held in module scope. On serverless that means it
 * survives a warm instance rather than forever, so the client also keeps a
 * copy in localStorage and the comparison basis is always labelled with how
 * old it is — an honest "compared with 6 minutes ago" beats a silent gap.
 */

export type ChangeKind =
  | "temperature"
  | "rain"
  | "pressure"
  | "commute"
  | "alert"
  | "air-quality"
  | "public-safety"
  | "road";

export type ChangeItem = {
  id: string;
  kind: ChangeKind;
  label: string;
  /** Rendered "from" and "to", already formatted. Null when not applicable. */
  from: string | null;
  to: string;
  /** Signed numeric delta where one exists, for colouring the row. */
  delta: number | null;
  /** What this was compared against, shown under the row. */
  basis: string;
  /** 0..1 importance, used for ordering and emphasis. */
  magnitude: number;
};

export type WhatChanged = {
  changes: ChangeItem[];
  /** When the comparison snapshot was taken, if there was one. */
  comparedAt: number | null;
  /** Human description of what was compared, for the card footer. */
  bases: string[];
};

/** The values a refresh remembers, so the next one can diff against them. */
export type DashboardSnapshot = {
  at: number;
  temperature: number | null;
  todayHigh: number | null;
  peakPrecipProbability: number | null;
  pressureInHg: number | null;
  commuteDelayMinutes: number | null;
  aqi: number | null;
  alertIds: string[];
  checkpointIds: string[];
};

/** Magnitude thresholds below which a change is not worth showing. */
const FLOOR = {
  temperature: 3,
  rain: 15,
  pressure: 0.04,
  commute: 4,
  aqi: 20,
} as const;

let previous: DashboardSnapshot | null = null;

export type ChangeInput = {
  weather: ModuleSnapshot<WeatherData>;
  weatherAlerts: ModuleSnapshot<WeatherAlert[]>;
  airQuality: ModuleSnapshot<AirQualityData>;
  commute: ModuleSnapshot<CommuteData>;
  publicSafety: ModuleSnapshot<PublicSafetyData>;
  /** A snapshot from the client's own last visit, if it sent one. */
  clientSnapshot?: DashboardSnapshot | null;
};

export function computeWhatChanged(input: ChangeInput): {
  whatChanged: WhatChanged;
  snapshot: DashboardSnapshot;
} {
  const current = takeSnapshot(input);
  // Prefer the client's snapshot: it reflects what this user last actually
  // saw, where the server's may be from another visitor's request.
  const comparison = input.clientSnapshot ?? previous;

  const changes: ChangeItem[] = [];
  const bases: string[] = [];

  const weather = input.weather.data;

  if (weather?.yesterday && weather.current) {
    const delta = weather.current.high - weather.yesterday.high;
    if (Math.abs(delta) >= FLOOR.temperature) {
      changes.push({
        id: "temperature-vs-yesterday",
        kind: "temperature",
        label: "Temperature",
        from: `${Math.round(weather.yesterday.high)}°`,
        to: `${Math.round(weather.current.high)}°`,
        delta,
        basis: "today's high vs yesterday's",
        magnitude: Math.min(1, Math.abs(delta) / 20),
      });
      bases.push("yesterday");
    }
  }

  if (comparison) {
    const age = formatAgo(comparison.at);
    bases.push(`the previous refresh (${age})`);

    const rainNow = current.peakPrecipProbability;
    const rainBefore = comparison.peakPrecipProbability;
    if (rainNow !== null && rainBefore !== null) {
      const delta = rainNow - rainBefore;
      if (Math.abs(delta) >= FLOOR.rain) {
        changes.push({
          id: "rain-vs-previous",
          kind: "rain",
          label: "Rain probability",
          from: `${Math.round(rainBefore)}%`,
          to: `${Math.round(rainNow)}%`,
          delta,
          basis: `forecast peak, revised since ${age}`,
          magnitude: Math.min(1, Math.abs(delta) / 50),
        });
      }
    }

    const pressureNow = current.pressureInHg;
    const pressureBefore = comparison.pressureInHg;
    if (pressureNow !== null && pressureBefore !== null) {
      const delta = pressureNow - pressureBefore;
      if (Math.abs(delta) >= FLOOR.pressure) {
        changes.push({
          id: "pressure-vs-previous",
          kind: "pressure",
          label: "Pressure",
          from: `${pressureBefore.toFixed(2)} inHg`,
          to: `${pressureNow.toFixed(2)} inHg`,
          delta,
          basis: `since ${age}`,
          magnitude: Math.min(1, Math.abs(delta) / 0.2),
        });
      }
    }

    const delayNow = current.commuteDelayMinutes;
    const delayBefore = comparison.commuteDelayMinutes;
    if (delayNow !== null && delayBefore !== null) {
      const delta = delayNow - delayBefore;
      if (Math.abs(delta) >= FLOOR.commute) {
        changes.push({
          id: "commute-vs-previous",
          kind: "commute",
          label: "Commute delay",
          from: `${Math.round(delayBefore)} min`,
          to: `${Math.round(delayNow)} min`,
          delta,
          basis: `since ${age}`,
          // Traffic swings are the most actionable thing on this list.
          magnitude: Math.min(1, Math.abs(delta) / 15),
        });
      }
    }

    const aqiNow = current.aqi;
    const aqiBefore = comparison.aqi;
    if (aqiNow !== null && aqiBefore !== null) {
      const delta = aqiNow - aqiBefore;
      if (Math.abs(delta) >= FLOOR.aqi) {
        changes.push({
          id: "aqi-vs-previous",
          kind: "air-quality",
          label: "Air quality",
          from: `AQI ${Math.round(aqiBefore)}`,
          to: `AQI ${Math.round(aqiNow)}`,
          delta,
          basis: `since ${age}`,
          magnitude: Math.min(1, Math.abs(delta) / 60),
        });
      }
    }

    const newAlerts = current.alertIds.filter((id) => !comparison.alertIds.includes(id));
    for (const id of newAlerts) {
      const alert = input.weatherAlerts.data?.find((candidate) => candidate.id === id);
      if (!alert) continue;
      changes.push({
        id: `alert-${id}`,
        kind: "alert",
        label: "Weather alert",
        from: null,
        to: `${alert.event} issued`,
        delta: null,
        basis: alert.source.name,
        // A newly issued warning outranks everything else here.
        magnitude: alert.severity === "critical" ? 1 : 0.75,
      });
    }

    const newCheckpoints = current.checkpointIds.filter(
      (id) => !comparison.checkpointIds.includes(id),
    );
    for (const id of newCheckpoints) {
      const checkpoint = input.publicSafety.data?.checkpoints.find(
        (candidate) => candidate.id === id,
      );
      if (!checkpoint) continue;
      changes.push({
        id: `checkpoint-${id}`,
        kind: "public-safety",
        label: "Public safety",
        from: null,
        to: `Newly found announcement — ${checkpoint.agency}`,
        delta: null,
        basis: checkpoint.sourceName,
        magnitude: 0.5,
      });
    }
  }

  previous = current;

  return {
    whatChanged: {
      changes: changes.sort((a, b) => b.magnitude - a.magnitude).slice(0, 8),
      comparedAt: comparison?.at ?? null,
      bases,
    },
    snapshot: current,
  };
}

function takeSnapshot(input: ChangeInput): DashboardSnapshot {
  const weather = input.weather.data;
  const next12 = weather
    ? weather.hourly.filter(
        (hour) => hour.time <= weather.current.observedAt + 12 * 3_600_000,
      )
    : [];

  const peak = next12.length
    ? Math.max(...next12.map((hour) => hour.precipProbability ?? 0))
    : null;

  return {
    at: Date.now(),
    temperature: weather?.current.temperature ?? null,
    todayHigh: weather?.current.high ?? null,
    peakPrecipProbability: peak,
    pressureInHg: weather?.current.pressureInHg ?? null,
    commuteDelayMinutes: input.commute.data?.delayMinutes ?? null,
    aqi: input.airQuality.data?.aqi ?? null,
    alertIds: (input.weatherAlerts.data ?? []).map((alert) => alert.id),
    checkpointIds: (input.publicSafety.data?.checkpoints ?? []).map(
      (checkpoint) => checkpoint.id,
    ),
  };
}

/** Validates a snapshot posted by the client before it is trusted for diffing. */
export function parseClientSnapshot(input: unknown): DashboardSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const at = typeof raw.at === "number" ? raw.at : null;
  // A snapshot older than a day says nothing useful about "what changed", and
  // one dated in the future is a broken clock.
  if (at === null || at > Date.now() + 60_000 || at < Date.now() - 86_400_000) {
    return null;
  }

  const numberOrNull = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 50)
      : [];

  return {
    at,
    temperature: numberOrNull(raw.temperature),
    todayHigh: numberOrNull(raw.todayHigh),
    peakPrecipProbability: numberOrNull(raw.peakPrecipProbability),
    pressureInHg: numberOrNull(raw.pressureInHg),
    commuteDelayMinutes: numberOrNull(raw.commuteDelayMinutes),
    aqi: numberOrNull(raw.aqi),
    alertIds: stringArray(raw.alertIds),
    checkpointIds: stringArray(raw.checkpointIds),
  };
}
