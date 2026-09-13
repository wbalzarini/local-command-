import { cached } from "../cache";
import { env } from "../env";
import { failureMessage, fetchJson } from "../http";
import type { Coordinates, SourceRef } from "@/types";

/**
 * Forward geocoding, used to verify the work destination.
 *
 * Only the *destination* is ever geocoded. The home end of the commute is
 * taken from configuration and defaults to the borough centroid, so the exact
 * home address is never sent to a third-party geocoder — which is the one
 * request that would hand a stranger the thing this app is most careful with.
 *
 * Results are cached for a day: a corporate campus does not move, and
 * Nominatim's usage policy asks callers not to repeat identical queries.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MAPBOX_URL = "https://api.mapbox.com/search/geocode/v6/forward";

const ONE_DAY = 24 * 60 * 60;

export type GeocodeResult = Coordinates & {
  /** The provider's canonical rendering of the address, for verification. */
  displayName: string;
  source: SourceRef;
};

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const result = await cached<GeocodeResult>(`geocode:${query}`, ONE_DAY, async () => {
    // Mapbox first when configured: it has better coverage of named commercial
    // sites, which is what a corporate address usually is.
    const viaMapbox = await geocodeMapbox(query);
    if (viaMapbox) return viaMapbox;
    return geocodeNominatim(query);
  });

  return result?.value ?? null;
}

async function geocodeMapbox(query: string): Promise<GeocodeResult | null> {
  const token = env.mapboxToken();
  if (!token) return null;

  type MapboxGeocode = {
    features?: {
      properties?: { full_address?: string; name?: string; coordinates?: { latitude?: number; longitude?: number } };
    }[];
  };

  const url =
    `${MAPBOX_URL}?q=${encodeURIComponent(query)}&limit=1&country=us` +
    `&access_token=${encodeURIComponent(token)}`;

  const response = await fetchJson<MapboxGeocode>(url, { timeoutMs: 8_000, revalidate: 0 });
  if (!response.ok) return null;

  const properties = response.value.features?.[0]?.properties;
  const lat = properties?.coordinates?.latitude;
  const lon = properties?.coordinates?.longitude;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return {
    lat,
    lon,
    displayName: properties?.full_address ?? properties?.name ?? query,
    source: {
      name: "Mapbox Geocoding",
      kind: "provider",
      url: "https://docs.mapbox.com/api/search/geocoding-v6/",
    },
  };
}

async function geocodeNominatim(query: string): Promise<GeocodeResult | null> {
  type NominatimResult = { lat?: string; lon?: string; display_name?: string };

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=us`;

  const response = await fetchJson<NominatimResult[]>(url, {
    timeoutMs: 8_000,
    revalidate: 0,
    // Nominatim's policy requires an identifiable User-Agent.
    headers: { "User-Agent": env.nwsUserAgent() },
  });

  if (!response.ok) {
    void failureMessage(response);
    return null;
  }

  const first = response.value?.[0];
  const lat = Number(first?.lat);
  const lon = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    lat,
    lon,
    displayName: first?.display_name ?? query,
    source: {
      name: "Nominatim / OpenStreetMap",
      kind: "provider",
      url: "https://operations.osmfoundation.org/policies/nominatim/",
    },
  };
}
