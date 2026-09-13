import { withModuleErrors } from "@/lib/api";
import { getWeather } from "@/lib/weather/service";

// Provider calls are bounded by lib/cache.ts, not by the framework's cache.
export const dynamic = "force-dynamic";

export async function GET() {
  return withModuleErrors("weather", "Weather", getWeather);
}
