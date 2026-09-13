import { withModuleErrors } from "@/lib/api";
import { getWeatherAlerts } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

/**
 * Official severe-weather alerts only.
 *
 * The Alert Center's full cross-module list comes from /api/command-center;
 * this route is the National Weather Service feed on its own, which is what
 * the Weather screens and the critical-alert banner read.
 */
export async function GET() {
  return withModuleErrors("weather-alerts", "Severe Weather", getWeatherAlerts);
}
