import { WeatherScreen } from "@/components/weather/WeatherScreen";
import { getAirQuality, getWeather, getWeatherAlerts } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export default async function WeatherPage() {
  // Independent modules, so they go out together rather than in sequence.
  const [weather, air, alerts] = await Promise.all([
    getWeather(),
    getAirQuality(),
    getWeatherAlerts(),
  ]);

  return <WeatherScreen weather={weather} air={air} alerts={alerts} />;
}
