import { failureMessage, fetchJson } from "../../http";
import type { RouteFetch, RoutingProvider, RouteRequest, Route, LatLng } from "../types";
import type { SourceRef } from "@/types";

/**
 * OSRM on the OpenStreetMap demo server: the keyless baseline.
 *
 * It exists so the commute module works on a fresh clone with no accounts set
 * up, and it produces genuinely useful output — real road geometry, real
 * distances, real free-flow drive times, real alternates. What it cannot do is
 * traffic: OSRM routes on a static road graph with no live speeds at all.
 *
 * So `trafficAware` is false, `delayMinutes` is null rather than zero, and the
 * UI states that the times are free-flow estimates. A zero delay would read as
 * "no traffic today", which is a claim this provider cannot support.
 *
 * The demo server is best-effort and rate-limited by its operators; a real
 * deployment should set MAPBOX_TOKEN, HERE_API_KEY or GOOGLE_MAPS_API_KEY.
 */

const BASE_URL = "https://router.project-osrm.org/route/v1/driving";

const SOURCE: SourceRef = {
  name: "OSRM / OpenStreetMap (free-flow only)",
  kind: "provider",
  url: "https://project-osrm.org/",
};

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: { summary?: string }[];
};

type OsrmResponse = { code?: string; routes?: OsrmRoute[] };

export const osrmProvider: RoutingProvider = {
  id: "osrm",
  source: SOURCE,
  trafficAware: false,

  async route(request: RouteRequest): Promise<RouteFetch> {
    const coordinates =
      `${request.origin.lon.toFixed(5)},${request.origin.lat.toFixed(5)};` +
      `${request.destination.lon.toFixed(5)},${request.destination.lat.toFixed(5)}`;

    const url =
      `${BASE_URL}/${coordinates}?alternatives=${request.alternates}` +
      `&overview=full&geometries=geojson&steps=true`;

    const response = await fetchJson<OsrmResponse>(url, {
      timeoutMs: 10_000,
      revalidate: 0,
    });

    if (!response.ok) return { ok: false, message: failureMessage(response) };
    if (response.value.code && response.value.code !== "Ok") {
      return { ok: false, message: `Router returned ${response.value.code}` };
    }

    const routes = (response.value.routes ?? [])
      .map((route, index) => toRoute(route, index))
      .filter((route): route is Route => route !== null);

    if (!routes.length) return { ok: false, message: "Router returned no routes" };

    return { ok: true, routes, provider: SOURCE, trafficAware: false };
  },
};

function toRoute(route: OsrmRoute, index: number): Route | null {
  if (typeof route.distance !== "number" || typeof route.duration !== "number") {
    return null;
  }

  const minutes = route.duration / 60;
  const geometry: LatLng[] | null = route.geometry?.coordinates
    ? // GeoJSON is [lon, lat]; the map wants [lat, lon].
      route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as LatLng)
    : null;

  return {
    id: `osrm-${index}`,
    label: index === 0 ? "Primary route" : `Alternate ${index}`,
    summary: summarise(route),
    distanceMiles: route.distance / 1609.344,
    durationMinutes: minutes,
    freeFlowMinutes: minutes,
    // Not zero: this provider has no opinion about traffic, and saying "+0 min"
    // would be an opinion.
    delayMinutes: null,
    trafficAware: false,
    geometry,
    incidents: [],
    isPrimary: index === 0,
  };
}

function summarise(route: OsrmRoute): string {
  const names = (route.legs ?? [])
    .map((leg) => leg.summary)
    .filter((summary): summary is string => Boolean(summary));
  return names.length ? names.join(" / ") : "Route";
}
