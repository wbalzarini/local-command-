import { defaultSettings, type Settings } from "../config";
import { parseClock } from "../format";

/**
 * Reading settings off a request.
 *
 * Settings live in the browser — there is no account and no database — so the
 * screens send the few values the server needs to compute a departure time or
 * a delay threshold. Everything is validated and clamped here: these are
 * URL parameters, which means anyone can type anything into them, and a
 * nonsense arrival time should fall back to the default rather than produce a
 * nonsense recommendation.
 */

const LIMITS = {
  trafficThreshold: { min: 1, max: 120 },
  weatherBuffer: { min: 0, max: 30 },
  alternateThreshold: { min: 1, max: 60 },
} as const;

export function settingsFromParams(params: URLSearchParams): Settings {
  const settings = defaultSettings();

  const arrival = params.get("arrival");
  if (arrival && parseClock(arrival) !== null) settings.arrivalTime = arrival;

  const days = params.get("days");
  if (days) {
    const parsed = days
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    if (parsed.length) settings.commuteDays = [...new Set(parsed)];
  }

  settings.trafficThresholdMinutes = clamped(
    params.get("trafficThreshold"),
    settings.trafficThresholdMinutes,
    LIMITS.trafficThreshold,
  );
  settings.weatherBufferMinutes = clamped(
    params.get("weatherBuffer"),
    settings.weatherBufferMinutes,
    LIMITS.weatherBuffer,
  );
  settings.alternateThresholdMinutes = clamped(
    params.get("alternateThreshold"),
    settings.alternateThresholdMinutes,
    LIMITS.alternateThreshold,
  );

  const emphasis = params.get("emphasis");
  if (emphasis === "auto" || emphasis === "workday" || emphasis === "weekend") {
    settings.emphasis = emphasis;
  }

  const disabled = params.get("disabledSources");
  if (disabled) {
    settings.disabledSources = disabled
      .split(",")
      .map((id) => id.trim())
      // Source ids are slugs; anything else is not one and is discarded.
      .filter((id) => /^[a-z0-9-]{1,60}$/.test(id))
      .slice(0, 40);
  }

  return settings;
}

/** The inverse, used by the client to build request URLs. */
export function settingsToParams(settings: Settings): URLSearchParams {
  const params = new URLSearchParams();
  params.set("arrival", settings.arrivalTime);
  params.set("days", settings.commuteDays.join(","));
  params.set("trafficThreshold", String(settings.trafficThresholdMinutes));
  params.set("weatherBuffer", String(settings.weatherBufferMinutes));
  params.set("alternateThreshold", String(settings.alternateThresholdMinutes));
  params.set("emphasis", settings.emphasis);
  if (settings.disabledSources?.length) {
    params.set("disabledSources", settings.disabledSources.join(","));
  }
  return params;
}

function clamped(
  raw: string | null,
  fallback: number,
  limit: { min: number; max: number },
): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, Math.round(value)));
}
