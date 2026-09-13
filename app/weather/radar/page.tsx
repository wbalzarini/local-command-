import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { RadarMap } from "@/components/radar/RadarMap";
import { weatherLocation } from "@/lib/config";
import { getRadar, getWeatherAlerts } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const [radar, alerts] = await Promise.all([getRadar(), getWeatherAlerts()]);

  const live =
    radar.status.state === "ok"
      ? ("live" as const)
      : radar.status.state === "unavailable"
        ? ("offline" as const)
        : ("degraded" as const);

  return (
    <>
      <CommandHeader location={weatherLocation().label} liveState={live} />
      <ModuleTabs moduleId="weather" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <RadarMap
          radar={radar}
          alerts={alerts.data ?? []}
          center={weatherLocation()}
          height={460}
        />
      </div>
    </>
  );
}
