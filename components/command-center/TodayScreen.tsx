"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { CommandHeader } from "./CommandHeader";
import { DayStatusCard } from "./DayStatusCard";
import { Next6Hours } from "./Next6Hours";
import { SystemStatus } from "./SystemStatus";
import { WhatChanged } from "./WhatChanged";
import { AlertBanner } from "./AlertBanner";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { CommuteCard } from "@/components/commute/CommuteCard";
import { CommuteImpact } from "@/components/commute/CommuteImpact";
import { DepartureCard } from "@/components/commute/DepartureCard";
import { RouteComparison } from "@/components/commute/RouteComparison";
import { TrafficMap } from "@/components/commute/TrafficMap";
import { RoadConditions } from "@/components/traffic/RoadConditions";
import { PublicSafetyPanel } from "@/components/public-safety/PublicSafetyPanel";
import { RadarMap } from "@/components/radar/RadarMap";
import { AirQuality } from "@/components/weather/AirQuality";
import { CurrentWeather } from "@/components/weather/CurrentWeather";
import { Daylight } from "@/components/weather/Daylight";
import { PressureCard } from "@/components/weather/PressureCard";
import { TenDayForecast } from "@/components/weather/TenDayForecast";
import { WeatherTrends } from "@/components/weather/WeatherTrends";
import { useCommandCenter } from "@/lib/useCommandCenter";
import { weatherLocation } from "@/lib/config";
import { inCommuteWindow } from "@/lib/routing/departure";
import { useSettings } from "@/lib/settings/store";
import type { CommandCenterData } from "@/lib/intelligence/commandCenter";

/**
 * The Today page: the whole dashboard, in the order that matters today.
 *
 * The section order comes from the module registry rather than from this
 * file's JSX, which is what lets the workday and weekend layouts be two data
 * arrays instead of two copies of the page. On a workday the commute sits
 * directly under the weather; on a weekend it drops to the bottom and the
 * outdoor-facing cards rise.
 *
 * Two pieces of behaviour are specific to this screen. Critical alerts are
 * hoisted above everything, including the briefing — a tornado warning is not
 * a card in a grid. And during commute hours on a small screen the commute
 * card sticks to the top of the viewport, because that is the one moment when
 * scrolling past it is the problem.
 */
export function TodayScreen({ initial }: { initial: CommandCenterData }) {
  const router = useRouter();
  const { settings } = useSettings();
  const { data, refreshing, error, refresh } = useCommandCenter(initial);

  // Unlocking sets a cookie; the server components need re-rendering to pick
  // it up, so the route is refreshed as well as the client data.
  const onUnlocked = useCallback(() => {
    router.refresh();
    refresh();
  }, [router, refresh]);

  const liveState = useMemo(() => {
    const states = data.system.map((module) => module.state);
    if (states.some((state) => state === "unavailable")) return "degraded" as const;
    if (states.every((state) => state === "ok" || state === "locked")) return "live" as const;
    return "degraded" as const;
  }, [data.system]);

  const commuteSticky = inCommuteWindow(settings) && data.emphasis === "workday";

  const sections = useMemo(() => {
    const byId: Record<string, React.ReactNode> = {
      briefing: <DailyBriefing key="briefing" briefing={data.briefing} />,
      "day-status": <DayStatusCard key="day-status" status={data.dayStatus} />,
      "current-weather": <CurrentWeather key="current-weather" weather={data.weather} />,
      commute: (
        <div
          key="commute"
          className={commuteSticky ? "sticky-rail bg-ink pb-1 lg:static lg:pb-0" : undefined}
        >
          <CommuteCard commute={data.commute} onUnlocked={onUnlocked} />
        </div>
      ),
      departure: <DepartureCard key="departure" commute={data.commute} />,
      alerts: (
        <AlertCenter key="alerts" alerts={data.alerts} counts={data.alertCounts} compact />
      ),
      "next-6": <Next6Hours key="next-6" weather={data.weather} />,
      pressure: <PressureCard key="pressure" weather={data.weather} />,
      trends: <WeatherTrends key="trends" weather={data.weather} />,
      "air-quality": <AirQuality key="air-quality" air={data.airQuality} />,
      radar: (
        <RadarMap
          key="radar"
          radar={data.radar}
          alerts={data.weatherAlerts.data ?? []}
          center={weatherLocation()}
          height={280}
          compact
        />
      ),
      forecast: <TenDayForecast key="forecast" weather={data.weather} />,
      "public-safety": (
        <PublicSafetyPanel key="public-safety" publicSafety={data.publicSafety} compact />
      ),
      "what-changed": <WhatChanged key="what-changed" data={data.whatChanged} />,
    };

    return byId;
  }, [data, commuteSticky, onUnlocked]);

  // Mobile is a single column in the registry's order. Wider screens promote
  // three cards into a summary row and pair the charts, which is the layout
  // the design calls for and is why the two are built separately rather than
  // with one grid and a pile of column spans.
  const order =
    data.emphasis === "weekend"
      ? [
          "briefing",
          "day-status",
          "current-weather",
          "alerts",
          "next-6",
          "air-quality",
          "pressure",
          "trends",
          "radar",
          "forecast",
          "public-safety",
          "commute",
          "departure",
          "what-changed",
        ]
      : [
          "briefing",
          "day-status",
          "current-weather",
          "commute",
          "departure",
          "alerts",
          "next-6",
          "pressure",
          "trends",
          "air-quality",
          "radar",
          "forecast",
          "public-safety",
          "what-changed",
        ];

  return (
    <>
      <CommandHeader
        dayStatus={data.dayStatus}
        location={weatherLocation().label}
        liveState={liveState}
      />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        {data.overriding.length ? <AlertBanner alerts={data.overriding} /> : null}

        <SystemStatus modules={data.system} generatedAt={data.generatedAt} />

        {error ? (
          <p className="border border-level-moderate-dim bg-level-moderate-dim/20 px-3 py-2 text-[12px] text-level-moderate">
            {error} — showing the last successful dashboard.
          </p>
        ) : null}

        {/* Single column on mobile, in the emphasis order. */}
        <div className="space-y-3 lg:hidden">
          {order.map((id) => sections[id])}
        </div>

        {/* Wide layout. */}
        <div className="hidden space-y-3 lg:block">
          {sections.briefing}

          <div className="grid grid-cols-3 gap-3">
            {data.emphasis === "workday" ? (
              <>
                <CurrentWeather weather={data.weather} compact />
                <CommuteCard commute={data.commute} onUnlocked={onUnlocked} compact />
                {sections["day-status"]}
              </>
            ) : (
              <>
                <CurrentWeather weather={data.weather} compact />
                <AirQuality air={data.airQuality} />
                {sections["day-status"]}
              </>
            )}
          </div>

          {sections["next-6"]}

          <div className="grid grid-cols-2 gap-3">
            {sections.trends}
            {sections.pressure}
          </div>

          {data.emphasis === "workday" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">{sections.radar}</div>
              <div className="space-y-3">
                {sections.departure}
                <Daylight weather={data.weather} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">{sections.radar}</div>
              <Daylight weather={data.weather} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <TrafficMap commute={data.commute} onUnlocked={onUnlocked} height={300} />
            </div>
            <div className="space-y-3">
              <RouteComparison commute={data.commute} />
              <CommuteImpact commute={data.commute} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {sections.alerts}
            {sections["public-safety"]}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{sections.forecast}</div>
            <div className="space-y-3">
              <RoadConditions roads={data.roads} onUnlocked={onUnlocked} />
              {data.emphasis === "weekend" ? sections.commute : sections["air-quality"]}
            </div>
          </div>

          {sections["what-changed"]}
        </div>

        <div className="flex justify-center pt-1 pb-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 border hairline border-line px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase transition-colors hover:text-fg disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh now"}
          </button>
        </div>
      </div>
    </>
  );
}
