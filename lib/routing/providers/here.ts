import { env } from "../../env";
import { failureMessage, fetchJson } from "../../http";
import type { Route, RouteFetch, RouteRequest, RoutingProvider } from "../types";
import type { SourceRef } from "@/types";

/**
 * HERE Routing v8.
 *
 * HERE gives both `duration` (with traffic) and `baseDuration` (without) in the
 * route summary, which is exactly the pair the delay calculation wants.
 *
 * Geometry is returned as HERE's flexible polyline, a different encoding from
 * Google's. Rather than ship a decoder for a format this app would use only
 * here, `geometry` is left null — the route comparison, timings and departure
 * recommendation all work, and the map says the geometry is unavailable from
 * this provider instead of drawing a wrong line.
 */

const BASE_URL = "https://router.hereapi.com/v8/routes";

const SOURCE: SourceRef = {
  name: "HERE Routing (traffic)",
  kind: "provider",
  url: "https://www.here.com/docs/bundle/routing-api-v8-api-reference/page/index.html",
};

type HereRoute = {
  id?: string;
  sections?: {
    summary?: { duration?: number; baseDuration?: number; length?: number };
    spans?: { names?: { value?: string }[] }[];
  }[];
};

type HereResponse = { routes?: HereRoute[]; notices?: { title?: string }[] };

export const hereProvider: RoutingProvider = {
  id: "here",
  source: SOURCE,
  trafficAware: true,

  async route(request: RouteRequest): Promise<RouteFetch> {
    const key = env.hereApiKey();
    if (!key) return { ok: false, message: "HERE_API_KEY is not configured" };

    const url =
      `${BASE_URL}?transportMode=car` +
      `&origin=${request.origin.lat.toFixed(5)},${request.origin.lon.toFixed(5)}` +
      `&destination=${request.destination.lat.toFixed(5)},${request.destination.lon.toFixed(5)}` +
      `&return=summary&alternatives=${request.alternates}&departureTime=any` +
      `&apikey=${encodeURIComponent(key)}`;

    const response = await fetchJson<HereResponse>(url, {
      timeoutMs: 10_000,
      revalidate: 0,
    });

    if (!response.ok) return { ok: false, message: failureMessage(response) };

    const routes = (response.value.routes ?? [])
      .map((route, index) => toRoute(route, index))
      .filter((route): route is Route => route !== null);

    if (!routes.length) {
      return {
        ok: false,
        message: response.value.notices?.[0]?.title ?? "Router returned no routes",
      };
    }

    return { ok: true, routes, provider: SOURCE, trafficAware: true };
  },
};

function toRoute(route: HereRoute, index: number): Route | null {
  const sections = route.sections ?? [];
  if (!sections.length) return null;

  // A car route can come back in several sections; the trip is their sum.
  let duration = 0;
  let baseDuration = 0;
  let length = 0;
  let hasBase = true;

  for (const section of sections) {
    const summary = section.summary;
    if (!summary || typeof summary.duration !== "number") return null;
    duration += summary.duration;
    length += summary.length ?? 0;
    if (typeof summary.baseDuration === "number") baseDuration += summary.baseDuration;
    else hasBase = false;
  }

  const durationMinutes = duration / 60;
  const freeFlowMinutes = hasBase ? baseDuration / 60 : null;

  return {
    id: route.id ?? `here-${index}`,
    label: index === 0 ? "Primary route" : `Alternate ${index}`,
    summary: "Route",
    distanceMiles: length / 1609.344,
    durationMinutes,
    freeFlowMinutes,
    delayMinutes: freeFlowMinutes === null ? null : durationMinutes - freeFlowMinutes,
    trafficAware: true,
    // Flexible polyline is not decoded here; see the note at the top.
    geometry: null,
    incidents: [],
    isPrimary: index === 0,
  };
}
