import { cached, lastSuccessAt } from "../cache";
import {
  commuteRefresh,
  defaultSettings,
  homePlace,
  REFRESH,
  workPlace,
  type Settings,
} from "../config";
import { env } from "../env";
import { formatMinutes, formatTime } from "../format";
import { fetchRoadEvents, PENNDOT_SOURCE } from "../traffic/roads";
import type { RoadsData } from "../traffic/types";
import type { WeatherData } from "../weather/types";
import { computeDeparture, computeImpact, inCommuteWindow } from "./departure";
import { DEMO_ROUTING_SOURCE, demoRoutes } from "./demo";
import { geocode } from "./geocode";
import { routingProviders } from "./provider";
import type { CommuteData, Route, RouteRecommendation } from "./types";
import type {
  Alert,
  ModuleSnapshot,
  ModuleStatus,
  SourceRef,
  StatusLevel,
} from "@/types";

/**
 * The commute service: the only way a screen gets route, traffic or road data.
 *
 * It owns three things the providers deliberately do not: which alternate is
 * worth switching to, what the weather does to the drive, and whether any of
 * it may be shown at all. That last one matters — the route reveals where the
 * user lives, so on a deployment with a passcode configured the whole module
 * comes back `locked` until the request is authorised, rather than being
 * filtered field by field in the UI where a mistake leaks the home address.
 */

/** Delay bands, in minutes, for the commute status light. */
const LEVEL_BANDS: { max: number; level: StatusLevel }[] = [
  { max: 5, level: "good" },
  { max: 15, level: "moderate" },
  { max: 30, level: "poor" },
  { max: Number.POSITIVE_INFINITY, level: "severe" },
];

export type CommuteRequest = {
  settings?: Settings;
  /** False when a passcode is configured and the caller has not entered it. */
  authorized: boolean;
  /** Weather for the drive window, used for the impact and buffers. */
  weather: WeatherData | null;
};

export async function getCommute(
  request: CommuteRequest,
): Promise<ModuleSnapshot<CommuteData>> {
  const settings = request.settings ?? defaultSettings();
  const inWindow = inCommuteWindow(settings);

  if (env.passcode() && !request.authorized) {
    return {
      id: "commute",
      label: "Commute",
      data: null,
      status: {
        state: "locked",
        message: "Enter the passcode to show your commute. The route is withheld because it identifies your home location.",
      },
      timestamp: Date.now(),
      sources: [],
      alerts: [],
      summary: "Commute details are protected on this deployment.",
    };
  }

  const origin = homePlace();
  const configuredWork = workPlace();

  // The destination is verified by geocoding its address; the configured
  // coordinates are the fallback when the geocoder is unreachable.
  const verified = configuredWork.address ? await geocode(configuredWork.address) : null;
  const destination = verified ?? configuredWork;

  const key = `commute:${origin.lat},${origin.lon}->${destination.lat},${destination.lon}`;
  const ttl = commuteRefresh(inWindow);

  if (env.demoMode()) {
    const routes = demoRoutes(origin, destination);
    return assemble({
      routes,
      provider: DEMO_ROUTING_SOURCE,
      trafficAware: true,
      settings,
      weather: request.weather,
      inWindow,
      status: { state: "demo", message: "Simulated routing data", lastSuccessAt: Date.now() },
      timestamp: Date.now(),
      destinationLabel: configuredWork.label,
      destinationAddress: configuredWork.address,
      originLabel: origin.label,
      roads: null,
    });
  }

  const result = await cached<{ routes: Route[]; provider: SourceRef; trafficAware: boolean }>(
    key,
    ttl,
    async () => {
      // Walk the provider chain; a configured provider that errors falls
      // through to the next rather than emptying the card.
      for (const provider of routingProviders()) {
        const response = await provider.route({
          origin,
          destination,
          alternates: 2,
        });
        if (response.ok) {
          return {
            routes: response.routes,
            provider: response.provider,
            trafficAware: response.trafficAware,
          };
        }
      }
      return null;
    },
  );

  if (!result) {
    return {
      id: "commute",
      label: "Commute",
      data: null,
      status: {
        state: "unavailable",
        message: "Traffic data temporarily unavailable.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: routingProviders().map((provider) => provider.source),
      alerts: [],
      summary: "Commute data is unavailable.",
    };
  }

  const roads = await loadRoads(origin, destination, result.value.routes);

  return assemble({
    routes: withRoadIncidents(result.value.routes, roads),
    provider: result.value.provider,
    trafficAware: result.value.trafficAware,
    settings,
    weather: request.weather,
    inWindow,
    status: result.stale
      ? {
          state: "stale",
          message: "Traffic data could not be refreshed — showing the last successful update.",
          lastSuccessAt: result.storedAt,
        }
      : { state: "ok", lastSuccessAt: result.storedAt },
    timestamp: result.storedAt,
    destinationLabel: configuredWork.label,
    destinationAddress: configuredWork.address,
    originLabel: origin.label,
    roads,
  });
}

type AssembleInput = {
  routes: Route[];
  provider: SourceRef;
  trafficAware: boolean;
  settings: Settings;
  weather: WeatherData | null;
  inWindow: boolean;
  status: ModuleStatus;
  timestamp: number;
  originLabel: string;
  destinationLabel: string;
  destinationAddress?: string;
  roads: RoadsData | null;
};

function assemble(input: AssembleInput): ModuleSnapshot<CommuteData> {
  const primary = input.routes.find((route) => route.isPrimary) ?? input.routes[0] ?? null;
  const departureAt = departureTime(input.settings, primary);
  const impact = computeImpact(primary, input.weather, input.settings, departureAt);
  const departure = computeDeparture(primary, impact, input.settings);
  const recommendation = recommendRoute(input.routes, primary, input.settings);

  const delayMinutes = primary?.delayMinutes ?? null;
  const level: StatusLevel =
    delayMinutes === null
      ? "unknown"
      : (LEVEL_BANDS.find((band) => delayMinutes < band.max)?.level ?? "severe");

  const data: CommuteData = {
    origin: { label: input.originLabel },
    destination: { label: input.destinationLabel, address: input.destinationAddress },
    routes: input.routes,
    primary,
    recommendation,
    normalMinutes: primary?.freeFlowMinutes ?? null,
    currentMinutes: primary?.durationMinutes ?? null,
    delayMinutes,
    level,
    trafficAware: input.trafficAware,
    impact,
    departure,
    inCommuteWindow: input.inWindow,
    provider: input.provider,
  };

  return {
    id: "commute",
    label: "Commute",
    data,
    status: input.status,
    timestamp: input.timestamp,
    sources: [
      { ...input.provider, fetchedAt: input.timestamp },
      ...(input.roads?.configured ? [PENNDOT_SOURCE] : []),
    ],
    alerts: commuteAlerts(data, input.settings),
    summary: summarise(data),
  };
}

/** When the drive is expected to start, for picking the right forecast hour. */
function departureTime(settings: Settings, primary: Route | null): number {
  const provisional = computeDeparture(primary, {
    trafficMinutes: primary?.delayMinutes ?? null,
    precipProbability: null,
    visibilityMiles: null,
    windGust: null,
    roadRisk: "low",
    weatherBufferMinutes: 0,
    factors: [],
    recommendation: "",
  }, settings);
  return provisional?.departAt ?? Date.now();
}

/**
 * Whether to recommend switching routes.
 *
 * The threshold exists because a router will happily report a ninety-second
 * difference between two routes, and acting on that is noise: the estimate's
 * own error is larger than the saving. Below the configured threshold the
 * primary stands.
 */
function recommendRoute(
  routes: Route[],
  primary: Route | null,
  settings: Settings,
): RouteRecommendation | null {
  if (!primary || routes.length < 2) return null;

  const fastest = routes.reduce((best, route) =>
    route.durationMinutes < best.durationMinutes ? route : best,
  );

  if (fastest.id === primary.id) return null;

  const savings = primary.durationMinutes - fastest.durationMinutes;
  if (savings < settings.alternateThresholdMinutes) return null;

  return {
    routeId: fastest.id,
    label: fastest.label,
    savingsMinutes: savings,
    reason: `Saves approximately ${Math.round(savings)} minutes versus the primary route${fastest.summary && fastest.summary !== "Route" ? ` via ${fastest.summary}` : ""}.`,
  };
}

/** Attaches reported road events to whichever routes they sit near. */
function withRoadIncidents(routes: Route[], roads: RoadsData | null): Route[] {
  if (!roads?.incidents.length) return routes;

  return routes.map((route) => {
    if (!route.geometry?.length) return route;

    const nearby = roads.incidents.filter((incident) => {
      if (!incident.coordinates) return false;
      return route.geometry!.some(
        ([lat, lon]) =>
          Math.abs(lat - incident.coordinates!.lat) < 0.02 &&
          Math.abs(lon - incident.coordinates!.lon) < 0.02,
      );
    });

    if (!nearby.length) return route;
    return { ...route, incidents: [...route.incidents, ...nearby] };
  });
}

async function loadRoads(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  routes: Route[],
): Promise<RoadsData | null> {
  const bounds = boundsFor(origin, destination, routes);
  const key = `roads:${bounds.minLat.toFixed(2)},${bounds.minLon.toFixed(2)}`;

  const result = await cached<RoadsData>(key, REFRESH.roads, async () => {
    const response = await fetchRoadEvents(env.penndotApiKey(), bounds);
    return response.ok ? response.data : null;
  });

  return result?.value ?? null;
}

/** A box around the whole trip, padded so nearby events still count. */
export function boundsFor(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  routes: Route[] = [],
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const lats = [origin.lat, destination.lat];
  const lons = [origin.lon, destination.lon];

  for (const route of routes) {
    for (const [lat, lon] of route.geometry ?? []) {
      lats.push(lat);
      lons.push(lon);
    }
  }

  const pad = 0.08;
  return {
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
    minLon: Math.min(...lons) - pad,
    maxLon: Math.max(...lons) + pad,
  };
}

function commuteAlerts(data: CommuteData, settings: Settings): Alert[] {
  const alerts: Alert[] = [];
  const source = data.provider;

  if (
    data.delayMinutes !== null &&
    data.delayMinutes >= settings.trafficThresholdMinutes
  ) {
    alerts.push({
      id: `commute-delay-${Math.round(data.delayMinutes)}`,
      module: "commute",
      category: "traffic-delay",
      severity: data.delayMinutes >= settings.trafficThresholdMinutes * 2 ? "important" : "advisory",
      priority: 2,
      title: `Commute delay +${Math.round(data.delayMinutes)} min`,
      body: `${formatMinutes(data.currentMinutes)} against a normal ${formatMinutes(data.normalMinutes)}.`,
      issuedAt: Date.now(),
      source,
    });
  }

  for (const route of data.routes) {
    for (const incident of route.incidents) {
      if (incident.type === "congestion") continue;
      alerts.push({
        id: `commute-incident-${incident.id}`,
        module: "commute",
        category: incident.type === "closure" ? "road-closure" : "traffic-incident",
        severity: incident.type === "closure" || incident.type === "accident" ? "important" : "advisory",
        priority: 2,
        title:
          incident.type === "closure"
            ? `Road closure: ${incident.location ?? incident.description}`
            : `${label(incident.type)} on ${route.label.toLowerCase()}`,
        body: incident.description,
        area: incident.location,
        issuedAt: incident.reportedAt,
        source: incident.source,
      });
    }
  }

  if (data.recommendation) {
    alerts.push({
      id: `commute-alternate-${data.recommendation.routeId}`,
      module: "commute",
      category: "traffic-delay",
      severity: "advisory",
      priority: 2,
      title: `Faster route available: ${data.recommendation.label}`,
      body: data.recommendation.reason,
      issuedAt: Date.now(),
      source,
    });
  }

  return alerts;
}

function label(type: string): string {
  switch (type) {
    case "accident":
      return "Accident";
    case "construction":
      return "Construction";
    case "disabled-vehicle":
      return "Disabled vehicle";
    case "weather":
      return "Weather-related road issue";
    default:
      return "Incident";
  }
}

function summarise(data: CommuteData): string {
  if (!data.primary) return "No route available.";

  if (!data.trafficAware) {
    return `${formatMinutes(data.currentMinutes)} to ${data.destination.label} — free-flow estimate only, no live traffic data configured.`;
  }

  const delay = data.delayMinutes ?? 0;
  const timing =
    delay >= 1
      ? `${formatMinutes(data.currentMinutes)}, ${Math.round(delay)} minutes slower than normal`
      : `${formatMinutes(data.currentMinutes)}, running normally`;

  const departure = data.departure
    ? ` Leave at ${formatTime(data.departure.departAt)} for a ${data.departure.arrivalTarget} arrival.`
    : "";

  return `Commute is ${timing}.${departure}`;
}

export async function getRoads(
  routes: Route[],
  authorized: boolean,
): Promise<ModuleSnapshot<RoadsData>> {
  if (env.passcode() && !authorized) {
    return {
      id: "roads",
      label: "Road Conditions",
      data: null,
      status: { state: "locked", message: "Enter the passcode to show road conditions along your route." },
      timestamp: Date.now(),
      sources: [],
      alerts: [],
      summary: "Road conditions are protected on this deployment.",
    };
  }

  const origin = homePlace();
  const destination = workPlace();
  const bounds = boundsFor(origin, destination, routes);
  const key = `roads:${bounds.minLat.toFixed(2)},${bounds.minLon.toFixed(2)}`;

  const response = await fetchRoadEvents(env.penndotApiKey(), bounds);

  if (!response.ok) {
    const notConfigured = "notConfigured" in response;
    return {
      id: "roads",
      label: "Road Conditions",
      data: {
        conditions: [],
        closures: [],
        incidents: [],
        configured: false,
        agency: PENNDOT_SOURCE.name,
      },
      status: {
        state: notConfigured ? "unavailable" : "unavailable",
        message: response.message,
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [PENNDOT_SOURCE],
      alerts: [],
      // Never "roads are clear".
      summary: notConfigured
        ? "No road-condition feed is configured, so closures and restrictions are not being monitored."
        : "Road condition feed is temporarily unavailable.",
    };
  }

  const data: RoadsData = {
    ...response.data,
    conditions: conditionsFor(routes, response.data),
  };

  return {
    id: "roads",
    label: "Road Conditions",
    data,
    status: { state: "ok", lastSuccessAt: Date.now() },
    timestamp: Date.now(),
    sources: [{ ...PENNDOT_SOURCE, fetchedAt: Date.now() }],
    alerts: data.closures.map((closure) => ({
      id: `road-${closure.id}`,
      module: "roads",
      category: closure.type === "closure" ? ("road-closure" as const) : ("road-condition" as const),
      severity: closure.type === "closure" ? ("important" as const) : ("advisory" as const),
      priority: 2 as const,
      title: `${closure.type === "closure" ? "Road closure" : "Road restriction"}: ${closure.location ?? closure.description}`,
      body: closure.description,
      area: closure.location,
      issuedAt: closure.reportedAt,
      source: closure.source,
    })),
    summary: data.closures.length
      ? `${data.closures.length} reported ${data.closures.length === 1 ? "closure or restriction" : "closures or restrictions"} near your route.`
      : `No closures or restrictions reported by ${data.agency} near your route.`,
  };
}

/**
 * Per-route condition lines.
 *
 * A route with no reported events is described as "no reported issues" rather
 * than "clear" — the feed reports what agencies have filed, not the state of
 * every mile of asphalt.
 */
function conditionsFor(routes: Route[], roads: RoadsData): RoadsData["conditions"] {
  if (!routes.length) {
    return [
      {
        label: "Route",
        level: "unknown",
        detail: "No route available to check.",
      },
    ];
  }

  return routes.map((route) => {
    const events = route.incidents.filter((incident) => incident.type !== "congestion");
    const closures = events.filter((incident) => incident.type === "closure");

    if (closures.length) {
      return {
        label: route.label,
        level: "poor" as const,
        detail: `${closures.length} reported ${closures.length === 1 ? "closure" : "closures"}`,
      };
    }
    if (events.length) {
      return {
        label: route.label,
        level: "moderate" as const,
        detail: `${events.length} reported ${events.length === 1 ? "event" : "events"}`,
      };
    }
    return {
      label: route.label,
      level: roads.configured ? ("good" as const) : ("unknown" as const),
      detail: roads.configured
        ? `No issues reported by ${roads.agency}`
        : "No road-condition feed configured",
    };
  });
}
