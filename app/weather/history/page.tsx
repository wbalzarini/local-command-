import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleTabs } from "@/components/command-center/Nav";
import { HistoryPanel } from "@/components/weather/HistoryPanel";
import { weatherLocation } from "@/lib/config";

/**
 * History is loaded by the client rather than server-rendered.
 *
 * A year of daily records plus the ten-year normals is a slow pair of upstream
 * calls, and blocking this route's first byte on them would make the module
 * feel broken. The panel shows its own loading state instead.
 */
export default function HistoryPage() {
  return (
    <>
      <CommandHeader location={weatherLocation().label} liveState="live" />
      <ModuleTabs moduleId="weather" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <HistoryPanel />
      </div>
    </>
  );
}
