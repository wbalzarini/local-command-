import { formatTime } from "../format";
import { condition, isFrozen } from "../weather/conditions";
import type { WeatherData } from "../weather/types";
import type { Alert, SourceRef } from "@/types";

/**
 * Alerts derived from the forecast, as distinct from alerts issued by the NWS.
 *
 * These exist because plenty of things worth knowing are never the subject of
 * an official product: a 70% chance of rain at 3pm, gusts that will push a car
 * around, the first freeze of the season. They are labelled with the forecast
 * provider as their source and never dressed up as government warnings, and
 * they sit below any real NWS alert in the priority order.
 */

const WINDOW_HOURS = 12;

const THRESHOLD = {
  /** Rain chance worth planning around. */
  precipProbability: 60,
  /** Gusts that affect driving. */
  gust: 35,
  /** Temperature swing across the day that changes what you wear. */
  swing: 18,
  rapidPressureFall: -0.09,
} as const;

export function weatherChangeAlerts(data: WeatherData, source: SourceRef): Alert[] {
  const alerts: Alert[] = [];
  const { current, hourly, pressure } = data;
  const horizon = hourly.filter(
    (hour) => hour.time <= current.observedAt + WINDOW_HOURS * 3_600_000,
  );

  const wettest = horizon.reduce<{ time: number; probability: number; code: number } | null>(
    (best, hour) => {
      const probability = hour.precipProbability;
      if (probability === null) return best;
      if (!best || probability > best.probability) {
        return { time: hour.time, probability, code: hour.conditionCode };
      }
      return best;
    },
    null,
  );

  if (wettest && wettest.probability >= THRESHOLD.precipProbability) {
    const family = condition(wettest.code).family;
    const label = family === "snow" ? "Snow" : family === "storm" ? "Thunderstorms" : "Rain";
    alerts.push({
      id: `weather-precip-${wettest.time}`,
      module: "weather",
      category: "weather-change",
      severity: wettest.probability >= 80 ? "important" : "advisory",
      priority: 4,
      title: `${label} likely — ${Math.round(wettest.probability)}% around ${formatTime(wettest.time)}`,
      body: `Forecast precipitation probability peaks at ${Math.round(wettest.probability)}% near ${formatTime(wettest.time)}.`,
      issuedAt: current.observedAt,
      expiresAt: wettest.time + 3_600_000,
      source,
    });
  }

  const gustiest = horizon.reduce<{ time: number; gust: number } | null>((best, hour) => {
    const gust = hour.windGust;
    if (gust === null) return best;
    if (!best || gust > best.gust) return { time: hour.time, gust };
    return best;
  }, null);

  if (gustiest && gustiest.gust >= THRESHOLD.gust) {
    alerts.push({
      id: `weather-gust-${gustiest.time}`,
      module: "weather",
      category: "weather-change",
      severity: gustiest.gust >= 50 ? "important" : "advisory",
      priority: 4,
      title: `Wind gusts to ${Math.round(gustiest.gust)} MPH around ${formatTime(gustiest.time)}`,
      body: "Gusts of this strength are felt on the road, particularly on bridges and open stretches.",
      issuedAt: current.observedAt,
      expiresAt: gustiest.time + 3_600_000,
      source,
    });
  }

  const next24 = hourly.filter(
    (hour) => hour.time <= current.observedAt + 24 * 3_600_000,
  );
  if (next24.length > 2) {
    const temperatures = next24.map((hour) => hour.temperature);
    const swing = Math.max(...temperatures) - Math.min(...temperatures);
    if (swing >= THRESHOLD.swing) {
      alerts.push({
        id: `weather-swing-${Math.round(current.observedAt / 3_600_000)}`,
        module: "weather",
        category: "weather-change",
        severity: "advisory",
        priority: 4,
        title: `${Math.round(swing)}° temperature swing in the next 24 hours`,
        body: `Forecast range ${Math.round(Math.min(...temperatures))}° to ${Math.round(Math.max(...temperatures))}°.`,
        issuedAt: current.observedAt,
        source,
      });
    }

    const freezing = next24.find((hour) => hour.temperature <= 32 || isFrozen(hour.conditionCode));
    if (freezing && current.temperature > 36) {
      alerts.push({
        id: `weather-freeze-${freezing.time}`,
        module: "weather",
        category: "weather-change",
        severity: "important",
        priority: 3,
        title: `Freezing conditions expected around ${formatTime(freezing.time)}`,
        body: "Surfaces may ice. This is a forecast reading, not an official advisory — check the Alerts module for issued products.",
        issuedAt: current.observedAt,
        expiresAt: freezing.time + 6 * 3_600_000,
        source,
      });
    }
  }

  if (pressure.change12h !== null && pressure.change12h <= THRESHOLD.rapidPressureFall) {
    alerts.push({
      id: `weather-pressure-${Math.round(current.observedAt / 3_600_000)}`,
      module: "weather",
      category: "weather-change",
      severity: "advisory",
      priority: 4,
      title: `Pressure down ${Math.abs(pressure.change12h).toFixed(2)} inHg in 12 hours`,
      body: pressure.interpretation,
      issuedAt: current.observedAt,
      source,
    });
  }

  return alerts;
}
