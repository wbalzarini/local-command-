import { CommuteScreen } from "@/components/commute/CommuteScreen";
import { isAuthorized } from "@/lib/auth";
import { getCommute, getRoads } from "@/lib/routing/service";
import { getWeather } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export default async function CommutePage() {
  const authorized = await isAuthorized();

  // The commute impact is scored against the forecast for the drive window, so
  // weather is read first; both come from caches on a warm instance.
  const weather = await getWeather();
  const commute = await getCommute({ authorized, weather: weather.data });
  const roads = await getRoads(commute.data?.routes ?? [], authorized);

  return <CommuteScreen commute={commute} roads={roads} />;
}
