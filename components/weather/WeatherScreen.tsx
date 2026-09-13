"use client";

import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { AirQuality } from "./AirQuality";
import { CurrentWeather } from "./CurrentWeather";
import { Daylight } from "./Daylight";
import { HourlyForecast } from "./HourlyForecast";
import { PressureCard } from "./PressureCard";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { weatherLocation } from "@/lib/config";
import type { AirQualityData, WeatherAlert, WeatherData } from "@/lib/weather/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The Weather module's landing screen: conditions now.
 *
 * Radar, the ten-day outlook, trends and history each have their own route, so
 * this page stays about the present — which is what someone opening "Weather"
 * is almost always asking about.
 */
export function WeatherScreen({
  weather,
  air,
  alerts,
}: {
  weather: ModuleSnapshot<WeatherData>;
  air: ModuleSnapshot<AirQualityData>;
  alerts: ModuleSnapshot<WeatherAlert[]>;
}) {
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
        {alerts.data?.length ? (
          <AlertCenter alerts={alerts.data} />
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <CurrentWeather weather={weather} />
          <div className="space-y-3">
            <PressureCard weather={weather} />
            <div className="grid gap-3 sm:grid-cols-2">
              <AirQuality air={air} />
              <Daylight weather={weather} />
            </div>
          </div>
        </div>

        <HourlyForecast weather={weather} />
      </div>
    </>
  );
}
