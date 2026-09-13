"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { CommuteCard } from "./CommuteCard";
import { CommuteImpact } from "./CommuteImpact";
import { DepartureCard } from "./DepartureCard";
import { RouteComparison } from "./RouteComparison";
import { TrafficMap } from "./TrafficMap";
import { RoadConditions } from "@/components/traffic/RoadConditions";
import { commuteWindowDescription } from "@/lib/routing/departure";
import { useSettings } from "@/lib/settings/store";
import type { CommuteData } from "@/lib/routing/types";
import type { RoadsData } from "@/lib/traffic/types";
import type { ModuleSnapshot } from "@/types";

/**
 * The Commute module.
 *
 * Selecting a route in the comparison list highlights it here; the map keeps
 * drawing all of them, because seeing why the alternate is longer is the point
 * of a map in the first place.
 */
export function CommuteScreen({
  commute,
  roads,
}: {
  commute: ModuleSnapshot<CommuteData>;
  roads: ModuleSnapshot<RoadsData>;
}) {
  const router = useRouter();
  const { settings } = useSettings();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const onUnlocked = useCallback(() => router.refresh(), [router]);

  const live =
    commute.status.state === "ok"
      ? ("live" as const)
      : commute.status.state === "unavailable"
        ? ("offline" as const)
        : ("degraded" as const);

  return (
    <>
      <CommandHeader
        location={commute.data?.destination.label ?? "Commute"}
        liveState={live}
      />
      <ModuleTabs moduleId="commute" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <CommuteCard commute={commute} onUnlocked={onUnlocked} />
          <div id="departure">
            <DepartureCard commute={commute} />
          </div>
        </div>

        <TrafficMap commute={commute} onUnlocked={onUnlocked} height={360} />

        <div className="grid gap-3 lg:grid-cols-2">
          <RouteComparison
            commute={commute}
            selectedId={selectedRoute}
            onSelect={setSelectedRoute}
          />
          <CommuteImpact commute={commute} />
        </div>

        <RoadConditions roads={roads} onUnlocked={onUnlocked} />

        <p className="px-1 text-[10px] leading-snug text-faint">
          Traffic refreshes every minute during commute windows
          ({commuteWindowDescription(settings)}) and every five minutes
          otherwise. Change your arrival time, commute days and thresholds in
          Settings.
        </p>
      </div>
    </>
  );
}
