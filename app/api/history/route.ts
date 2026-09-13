import { withModuleErrors } from "@/lib/api";
import { getWeather, getWeatherHistory } from "@/lib/weather/service";
import type { HistoryRange } from "@/lib/weather/types";

export const dynamic = "force-dynamic";

const RANGES: HistoryRange[] = ["24h", "7d", "30d", "1y"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("range");
  const range: HistoryRange = RANGES.includes(requested as HistoryRange)
    ? (requested as HistoryRange)
    : "24h";

  return withModuleErrors("weather-history", "History", async () => {
    // Today's own numbers come from the forecast module so the "vs normal"
    // comparison is against the same values shown elsewhere on the dashboard.
    const weather = await getWeather();
    const today = weather.data
      ? {
          temperature: (weather.data.current.high + weather.data.current.low) / 2,
          precipitation: weather.data.daily[0]?.precipitation ?? null,
          wind: weather.data.daily[0]?.windSpeed ?? null,
        }
      : { temperature: null, precipitation: null, wind: null };

    return getWeatherHistory(range, today);
  });
}
