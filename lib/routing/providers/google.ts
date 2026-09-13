import { env } from "../../env";
import { failureMessage, fetchJson } from "../../http";
import { decodePolyline } from "../polyline";
import type { LatLng, Route, RouteFetch, RouteRequest, RoutingProvider } from "../types";
import type { SourceRef } from "@/types";

/**
 * Google Routes API v2.
 *
 * `TRAFFIC_AWARE_OPTIMAL` with `computeAlternativeRoutes` returns both
 * `duration` (with current traffic) and `staticDuration` (without), so the
 * delay is again a measured difference. The field mask is required by the API
 * and is also the thing that keeps the response — and the bill — small.
 */

const URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const SOURCE: SourceRef = {
  name: "Google Routes (traffic)",
  kind: "provider",
  url: "https://developers.google.com/maps/documentation/routes",
};

const FIELD_MASK = [
  "routes.duration",
  "routes.staticDuration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.description",
].join(",");

type GoogleRoute = {
  duration?: string;
  staticDuration?: string;
  distanceMeters?: number;
  description?: string;
  polyline?: { encodedPolyline?: string };
};

type GoogleResponse = { routes?: GoogleRoute[]; error?: { message?: string } };

export const googleProvider: RoutingProvider = {
  id: "google",
  source: SOURCE,
  trafficAware: true,

  async route(request: RouteRequest): Promise<RouteFetch> {
    const key = env.googleMapsApiKey();
    if (!key) return { ok: false, message: "GOOGLE_MAPS_API_KEY is not configured" };

    const response = await fetchJson<GoogleResponse>(URL, {
      method: "POST",
      timeoutMs: 10_000,
      revalidate: 0,
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: {
        origin: {
          location: {
            latLng: { latitude: request.origin.lat, longitude: request.origin.lon },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: request.destination.lat,
              longitude: request.destination.lon,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE_OPTIMAL",
        computeAlternativeRoutes: request.alternates > 0,
        units: "IMPERIAL",
      },
    });

    if (!response.ok) return { ok: false, message: failureMessage(response) };
    if (response.value.error) {
      return { ok: false, message: response.value.error.message ?? "Router error" };
    }

    const routes = (response.value.routes ?? [])
      .map((route, index) => toRoute(route, index))
      .filter((route): route is Route => route !== null);

    if (!routes.length) return { ok: false, message: "Router returned no routes" };

    return { ok: true, routes, provider: SOURCE, trafficAware: true };
  },
};

function toRoute(route: GoogleRoute, index: number): Route | null {
  const durationMinutes = toMinutes(route.duration);
  if (durationMinutes === null || typeof route.distanceMeters !== "number") return null;

  const freeFlowMinutes = toMinutes(route.staticDuration);
  const encoded = route.polyline?.encodedPolyline;
  const geometry: LatLng[] | null = encoded
    ? (decodePolyline(encoded) as LatLng[])
    : null;

  return {
    id: `google-${index}`,
    label: index === 0 ? "Primary route" : `Alternate ${index}`,
    summary: route.description ?? "Route",
    distanceMiles: route.distanceMeters / 1609.344,
    durationMinutes,
    freeFlowMinutes,
    delayMinutes: freeFlowMinutes === null ? null : durationMinutes - freeFlowMinutes,
    trafficAware: true,
    geometry,
    incidents: [],
    isPrimary: index === 0,
  };
}

/** Google returns durations as protobuf duration strings: "1234s". */
function toMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? seconds / 60 : null;
}
