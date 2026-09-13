import { withModuleErrors } from "@/lib/api";
import { isAuthorized } from "@/lib/auth";
import { getCommute } from "@/lib/routing/service";
import { settingsFromParams } from "@/lib/settings/params";
import { getWeather } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

/**
 * The commute module.
 *
 * Gated: with a passcode configured, an unauthorised request gets a `locked`
 * snapshot with no route in it at all. The gate is checked here rather than in
 * the component so the route geometry — which shows where the user lives —
 * never leaves the server in the first place.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = settingsFromParams(searchParams);
  const authorized = await isAuthorized();

  return withModuleErrors("commute", "Commute", async () => {
    // The drive is scored against the forecast for the hour it happens, so the
    // weather module is read first.
    const weather = await getWeather();
    return getCommute({ settings, authorized, weather: weather.data });
  });
}
