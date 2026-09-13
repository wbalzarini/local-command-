import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { Next6Hours } from "@/components/command-center/Next6Hours";
import { PressureCard } from "@/components/weather/PressureCard";
import { WeatherTrends } from "@/components/weather/WeatherTrends";
import { weatherLocation } from "@/lib/config";
import { getWeather } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
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
        <Next6Hours weather={weather} />
        <div className="grid gap-3 lg:grid-cols-2">
          <WeatherTrends weather={weather} />
          <PressureCard weather={weather} />
        </div>
      </div>
    </>
  );
}
