/**
 * Every environment variable the app reads, in one place.
 *
 * All of these are server-only. No provider key is ever exposed to the
 * browser: the client talks exclusively to this app's own /api routes, which
 * is what keeps a key out of a bundle and the home address off the wire.
 */

function str(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function num(name: string): number | undefined {
  const raw = str(name);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const env = {
  /**
   * Traffic-aware routing. Without one of these the app still routes, but on
   * free-flow times only — and says so rather than implying live traffic.
   */
  mapboxToken: () => str("MAPBOX_TOKEN"),
  hereApiKey: () => str("HERE_API_KEY"),
  googleMapsApiKey: () => str("GOOGLE_MAPS_API_KEY"),

  /** Optional commercial weather providers. Open-Meteo is used when unset. */
  openWeatherApiKey: () => str("OPENWEATHER_API_KEY"),
  tomorrowApiKey: () => str("TOMORROW_API_KEY"),
  weatherApiKey: () => str("WEATHERAPI_KEY"),

  /** PennDOT / 511PA developer key, for road conditions and closures. */
  penndotApiKey: () => str("PENNDOT_API_KEY"),

  /**
   * Contact string sent as User-Agent to api.weather.gov, which NWS requires
   * of API consumers so they can reach the operator of a misbehaving client.
   */
  nwsUserAgent: () =>
    str("NWS_USER_AGENT") ?? "PersonalCommandCenter (contact not configured)",

  /** Locations. Home coordinates default to the town, never the doorstep. */
  homeLat: () => num("HOME_LAT"),
  homeLon: () => num("HOME_LON"),
  homeLabel: () => str("HOME_LABEL"),
  homeAddress: () => str("HOME_ADDRESS"),
  workLat: () => num("WORK_LAT"),
  workLon: () => num("WORK_LON"),
  workLabel: () => str("WORK_LABEL"),
  workAddress: () => str("WORK_ADDRESS"),

  /**
   * Passcode gate. When set, the commute route (which reveals where the user
   * lives) is withheld until the passcode is entered. Unset on a private
   * deployment means no gate.
   */
  passcode: () => str("COMMAND_CENTER_PASSCODE"),

  /** Forces labelled sample data everywhere, for UI work without keys. */
  demoMode: () => str("DEMO_MODE") === "1",
} as const;

/** True when a provider that actually knows about live traffic is configured. */
export function hasTrafficProvider(): boolean {
  return Boolean(env.mapboxToken() ?? env.hereApiKey() ?? env.googleMapsApiKey());
}
