import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { gateEnabled, isAuthorized } from "@/lib/auth";
import { homePlace, workPlace } from "@/lib/config";
import { env } from "@/lib/env";
import { SOURCES } from "@/lib/sources/registry";
import { getPublicSafety } from "@/lib/sources/service";

/**
 * Dynamic: reads the passcode state and the live source statuses.
 */
export const dynamic = "force-dynamic";

/**
 * Settings.
 *
 * The server passes down the registry, the gate state and which providers are
 * configured — and, for the locations, labels only. The home address is read
 * from the environment on the server to build routes and is deliberately not
 * included here: a settings page is exactly the sort of place a home address
 * quietly ends up in a client bundle.
 */
export default async function SettingsPage() {
  const [authorized, publicSafety] = await Promise.all([
    isAuthorized(),
    getPublicSafety(),
  ]);

  const home = homePlace();
  const work = workPlace();

  return (
    <SettingsScreen
      locations={{
        homeLabel: home.label,
        homeConfigured: env.homeLat() !== undefined && env.homeLon() !== undefined,
        workLabel: work.label,
        workAddress: work.address,
      }}
      sources={SOURCES}
      sourceStatuses={publicSafety.data?.sources ?? []}
      gateEnabled={gateEnabled()}
      authorized={authorized}
      providers={{
        weather: env.demoMode()
          ? "Simulated sample data (DEMO_MODE)"
          : "Open-Meteo (keyless) + National Weather Service alerts",
        radar: env.demoMode() ? "Not simulated" : "RainViewer (keyless)",
        traffic: env.mapboxToken()
          ? "Mapbox Directions (traffic-aware)"
          : env.hereApiKey()
            ? "HERE Routing (traffic-aware)"
            : env.googleMapsApiKey()
              ? "Google Routes (traffic-aware)"
              : "Not configured — OSRM free-flow estimates only",
        roads: env.penndotApiKey()
          ? "PennDOT 511PA"
          : "Not configured — closures are not monitored",
      }}
    />
  );
}
