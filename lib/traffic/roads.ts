import { failureMessage, fetchJson } from "../http";
import type { RouteIncident } from "../routing/types";
import type { SourceRef } from "@/types";
import type { RoadClosure, RoadsData } from "./types";

/**
 * Road conditions, closures and construction from PennDOT's 511PA feed.
 *
 * 511PA is the authoritative source for Pennsylvania state roads, which is
 * most of this commute's first half. It needs a developer key, and the feed's
 * exact endpoint and field names have changed across versions of their API —
 * so both the URL and the key are configuration, and the parser below reads
 * defensively and accepts several spellings of the same field.
 *
 * When no feed is configured the module reports `configured: false` and the UI
 * says road-condition reporting is not set up. It does not say the roads are
 * clear: this app never turns "we did not ask" into "there is nothing".
 */

/** Default is 511PA's v2 event endpoint; override if their contract moves. */
const DEFAULT_EVENTS_URL = "https://www.511pa.com/api/v2/get/event";

const PENNDOT_SOURCE: SourceRef = {
  name: "PennDOT 511PA",
  kind: "government",
  url: "https://www.511pa.com/",
};

type RawEvent = Record<string, unknown>;

export type RoadsFetch =
  | { ok: true; data: RoadsData }
  | { ok: false; message: string }
  | { ok: false; notConfigured: true; message: string };

export async function fetchRoadEvents(
  apiKey: string | undefined,
  /** Only events inside this box are kept, so the list stays about this drive. */
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  eventsUrl = process.env.PENNDOT_EVENTS_URL ?? DEFAULT_EVENTS_URL,
): Promise<RoadsFetch> {
  if (!apiKey) {
    return {
      ok: false,
      notConfigured: true,
      message:
        "No road-condition feed configured. Set PENNDOT_API_KEY to report PennDOT closures, construction and restrictions.",
    };
  }

  const url = `${eventsUrl}${eventsUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}&format=json`;

  const response = await fetchJson<RawEvent[] | { events?: RawEvent[] }>(url, {
    timeoutMs: 10_000,
    revalidate: 0,
  });

  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const raw = Array.isArray(response.value)
    ? response.value
    : Array.isArray(response.value.events)
      ? response.value.events
      : [];

  const closures: RoadClosure[] = [];
  const incidents: RouteIncident[] = [];

  for (const event of raw) {
    const lat = firstNumber(event, ["latitude", "Latitude", "lat"]);
    const lon = firstNumber(event, ["longitude", "Longitude", "lon", "lng"]);
    if (lat === null || lon === null) continue;
    if (lat < bounds.minLat || lat > bounds.maxLat) continue;
    if (lon < bounds.minLon || lon > bounds.maxLon) continue;

    const description =
      firstString(event, ["description", "Description", "headline", "eventDescription"]) ??
      "Reported road event";
    const location = firstString(event, ["roadwayName", "RoadwayName", "location", "road"]);
    const category = firstString(event, ["eventType", "EventType", "type", "category"]) ?? "";
    const id =
      firstString(event, ["id", "ID", "eventId", "EventID"]) ??
      `penndot-${lat.toFixed(4)},${lon.toFixed(4)}`;
    const reportedAt = firstTimestamp(event, ["startTime", "StartTime", "lastUpdated", "reported"]);

    const kind = classify(category, description);

    if (kind === "closure" || kind === "construction" || kind === "flooding" || kind === "snow-ice" || kind === "bridge-restriction") {
      closures.push({
        id,
        description,
        location: location ?? undefined,
        type: kind,
        reportedAt,
        source: PENNDOT_SOURCE,
      });
    }

    incidents.push({
      id,
      type:
        kind === "closure"
          ? "closure"
          : kind === "construction"
            ? "construction"
            : kind === "flooding" || kind === "snow-ice"
              ? "weather"
              : /crash|accident|collision/i.test(`${category} ${description}`)
                ? "accident"
                : /disabled/i.test(`${category} ${description}`)
                  ? "disabled-vehicle"
                  : "other",
      description,
      location: location ?? undefined,
      reportedAt,
      // Only reported where the agency states one; never estimated here.
      delayMinutes: firstNumber(event, ["delay", "Delay", "delayMinutes"]),
      coordinates: { lat, lon },
      source: PENNDOT_SOURCE,
    });
  }

  return {
    ok: true,
    data: {
      // Conditions per route are filled in by the service, which knows the routes.
      conditions: [],
      closures,
      incidents,
      configured: true,
      agency: PENNDOT_SOURCE.name,
    },
  };
}

function classify(category: string, description: string): RoadClosure["type"] | "incident" {
  const text = `${category} ${description}`.toLowerCase();
  if (/closed|closure/.test(text)) return "closure";
  if (/construction|roadwork|work zone|paving/.test(text)) return "construction";
  if (/flood|high water/.test(text)) return "flooding";
  if (/snow|ice|icy|sleet/.test(text)) return "snow-ice";
  if (/bridge.*(restrict|weight|closed)/.test(text)) return "bridge-restriction";
  return "incident";
}

function firstString(event: RawEvent, keys: string[]): string | null {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(event: RawEvent, keys: string[]): number | null {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function firstTimestamp(event: RawEvent, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      // Feeds vary between seconds and milliseconds.
      return value > 1e12 ? value : value * 1000;
    }
    if (typeof value === "string") {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

export { PENNDOT_SOURCE };
