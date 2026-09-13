import { env } from "../../env";
import { failureMessage, fetchJson } from "../../http";
import type { LatLng, Route, RouteFetch, RouteRequest, RoutingProvider } from "../types";
import type { SourceRef } from "@/types";

/**
 * Mapbox Directions on the driving-traffic profile.
 *
 * The preferred provider when a token is configured: it returns a live
 * traffic-aware duration *and* `duration_typical` for the same route, which
 * gives the delay as a measured difference rather than a guess at what
 * "normal" means. The congestion annotation is what lets the map colour the
 * slow stretches.
 */

const BASE_URL = "https://api.mapbox.com/directions/v5/mapbox/driving-traffic";

const SOURCE: SourceRef = {
  name: "Mapbox Directions (traffic)",
  kind: "provider",
  url: "https://docs.mapbox.com/api/navigation/directions/",
};

type MapboxRoute = {
  distance?: number;
  duration?: number;
  duration_typical?: number;
  weight_name?: string;
  geometry?: { coordinates?: [number, number][] };
  legs?: {
    summary?: string;
    annotation?: { congestion?: string[] };
  }[];
};

type MapboxResponse = { code?: string; routes?: MapboxRoute[]; message?: string };

export const mapboxProvider: RoutingProvider = {
  id: "mapbox",
  source: SOURCE,
  trafficAware: true,

  async route(request: RouteRequest): Promise<RouteFetch> {
    const token = env.mapboxToken();
    if (!token) return { ok: false, message: "MAPBOX_TOKEN is not configured" };

    const coordinates =
      `${request.origin.lon.toFixed(5)},${request.origin.lat.toFixed(5)};` +
      `${request.destination.lon.toFixed(5)},${request.destination.lat.toFixed(5)}`;

    const url =
      `${BASE_URL}/${coordinates}?alternatives=true&geometries=geojson&overview=full` +
      `&annotations=duration,congestion&steps=true&access_token=${encodeURIComponent(token)}`;

    const response = await fetchJson<MapboxResponse>(url, {
      timeoutMs: 10_000,
      revalidate: 0,
    });

    if (!response.ok) return { ok: false, message: failureMessage(response) };
    if (response.value.code && response.value.code !== "Ok") {
      return {
        ok: false,
        message: response.value.message ?? `Router returned ${response.value.code}`,
      };
    }

    const routes = (response.value.routes ?? [])
      .map((route, index) => toRoute(route, index))
      .filter((route): route is Route => route !== null);

    if (!routes.length) return { ok: false, message: "Router returned no routes" };

    return { ok: true, routes, provider: SOURCE, trafficAware: true };
  },
};

function toRoute(route: MapboxRoute, index: number): Route | null {
  if (typeof route.distance !== "number" || typeof route.duration !== "number") {
    return null;
  }

  const durationMinutes = route.duration / 60;
  const freeFlowMinutes =
    typeof route.duration_typical === "number" ? route.duration_typical / 60 : null;

  const geometry: LatLng[] | null = route.geometry?.coordinates
    ? route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as LatLng)
    : null;

  return {
    id: `mapbox-${index}`,
    label: index === 0 ? "Primary route" : `Alternate ${index}`,
    summary:
      (route.legs ?? [])
        .map((leg) => leg.summary)
        .filter((summary): summary is string => Boolean(summary))
        .join(" / ") || "Route",
    distanceMiles: route.distance / 1609.344,
    durationMinutes,
    freeFlowMinutes,
    delayMinutes: freeFlowMinutes === null ? null : durationMinutes - freeFlowMinutes,
    trafficAware: true,
    geometry,
    incidents: congestionIncidents(route, index),
    isPrimary: index === 0,
  };
}

/**
 * Severe congestion, reported as what it is: a traffic-speed reading.
 *
 * Mapbox's congestion annotation says a stretch is slow, not why. These are
 * therefore typed `congestion` and described as heavy traffic — never promoted
 * to "accident", which would be inventing a cause the data does not carry.
 * Real reported incidents come from the road-conditions feed instead.
 */
function congestionIncidents(route: MapboxRoute, routeIndex: number) {
  const congestion = route.legs?.[0]?.annotation?.congestion;
  if (!congestion?.length) return [];

  const severe = congestion.filter((level) => level === "severe").length;
  const heavy = congestion.filter((level) => level === "heavy").length;
  const share = (severe + heavy) / congestion.length;

  // Below roughly a tenth of the route, slow segments are normal variation
  // rather than something worth a line in the incident list.
  if (share < 0.1) return [];

  return [
    {
      id: `mapbox-congestion-${routeIndex}`,
      type: "congestion" as const,
      description:
        severe > 0
          ? `Heavy to stop-and-go traffic across roughly ${Math.round(share * 100)}% of this route`
          : `Heavy traffic across roughly ${Math.round(share * 100)}% of this route`,
      delayMinutes: null,
      source: SOURCE,
    },
  ];
}
