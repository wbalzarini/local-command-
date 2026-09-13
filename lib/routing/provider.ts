import { env } from "../env";
import { googleProvider } from "./providers/google";
import { hereProvider } from "./providers/here";
import { mapboxProvider } from "./providers/mapbox";
import { osrmProvider } from "./providers/osrm";
import type { RoutingProvider } from "./types";

/**
 * Which router to use, in preference order.
 *
 * Traffic-aware providers first, since the commute module's whole purpose is
 * the difference between normal and now. OSRM is the floor: keyless, always
 * available, honest about having no traffic model. The chain is also the
 * failover order — if the configured provider errors, the service falls back
 * down the list rather than showing an empty commute card.
 */
export function routingProviders(): RoutingProvider[] {
  const chain: RoutingProvider[] = [];
  if (env.mapboxToken()) chain.push(mapboxProvider);
  if (env.hereApiKey()) chain.push(hereProvider);
  if (env.googleMapsApiKey()) chain.push(googleProvider);
  chain.push(osrmProvider);
  return chain;
}
