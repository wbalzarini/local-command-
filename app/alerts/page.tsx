import { CommandHeader } from "@/components/command-center/CommandHeader";
import { AlertBanner } from "@/components/command-center/AlertBanner";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { isAuthorized } from "@/lib/auth";
import { weatherLocation } from "@/lib/config";
import { getCommandCenter } from "@/lib/intelligence/commandCenter";
import { PRIORITY_LABELS } from "@/lib/alerts/engine";

export const dynamic = "force-dynamic";

/**
 * The Alert Center as its own module.
 *
 * Reads the same aggregate as Today, because the alert list is a property of
 * the whole system rather than of any one module — a commute delay and a flood
 * watch belong in one ranked list or the ranking means nothing.
 */
export default async function AlertsPage() {
  const data = await getCommandCenter({
    authorized: await isAuthorized(),
    trimSeries: true,
  });

  const live = data.system.some((module) => module.state === "unavailable")
    ? ("degraded" as const)
    : ("live" as const);

  return (
    <>
      <CommandHeader
        dayStatus={data.dayStatus}
        location={weatherLocation().label}
        liveState={live}
      />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        {data.overriding.length ? <AlertBanner alerts={data.overriding} /> : null}

        <AlertCenter alerts={data.alerts} counts={data.alertCounts} />

        <section className="border hairline border-line bg-surface/40 px-3 py-2.5">
          <h2 className="micro micro-bright">How alerts are ordered</h2>
          <ol className="mt-2 space-y-1">
            {Object.entries(PRIORITY_LABELS).map(([priority, label]) => (
              <li key={priority} className="flex gap-2 text-[11px] text-muted">
                <span className="tnum w-4 shrink-0 font-mono text-faint">{priority}</span>
                {label}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] leading-snug text-faint">
            Each module assigns the priority of the alerts it raises; the Alert
            Center only ranks them. Official National Weather Service products
            always outrank forecast-derived advisories from this app.
          </p>
        </section>
      </div>
    </>
  );
}
