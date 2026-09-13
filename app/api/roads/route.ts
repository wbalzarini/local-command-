import { withModuleErrors } from "@/lib/api";
import { isAuthorized } from "@/lib/auth";
import { getCommute, getRoads } from "@/lib/routing/service";
import { settingsFromParams } from "@/lib/settings/params";
import { getWeather } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

/**
 * Road conditions along the commute.
 *
 * Reported closures and restrictions are matched to routes, so the routes are
 * resolved first. Both come from caches, so this is not two round trips to the
 * providers on every request.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = settingsFromParams(searchParams);
  const authorized = await isAuthorized();

  return withModuleErrors("roads", "Road Conditions", async () => {
    const weather = await getWeather();
    const commute = await getCommute({ settings, authorized, weather: weather.data });
    return getRoads(commute.data?.routes ?? [], authorized);
  });
}
