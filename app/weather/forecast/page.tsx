import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { HourlyForecast } from "@/components/weather/HourlyForecast";
import { TenDayForecast } from "@/components/weather/TenDayForecast";
import { weatherLocation } from "@/lib/config";
import { getWeather } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const weather = await getWeather();

  const live =
    weather.status.state === "ok"
      ? ("live" as const)
      : weather.status.state === "unavailable"
        ? ("offline" as const)
        : ("degraded" as const);

  return (
    <>
      <CommandHeader location={weatherLocation().label} liveState={live} />
      <ModuleTabs moduleId="weather" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <HourlyForecast weather={weather} />
        <TenDayForecast weather={weather} />
      </div>
    </>
  );
}
