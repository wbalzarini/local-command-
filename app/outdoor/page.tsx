import { CommandHeader } from "@/components/command-center/CommandHeader";
import { ModuleIcon } from "@/components/command-center/ModuleIcon";
import { FUTURE_MODULES, moduleById } from "@/lib/modules/registry";
import { weatherLocation } from "@/lib/config";

/**
 * The Outdoor placeholder, and the roadmap.
 *
 * A placeholder that says what it will contain and how a module gets added is
 * more useful than a hidden route. It also documents the contract — data,
 * status, timestamp, alerts, summary — which is the thing a future module has
 * to satisfy for Today to pick it up automatically.
 */
export default function OutdoorPage() {
  const outdoor = moduleById("outdoor");

  return (
    <>
      <CommandHeader location={weatherLocation().label} liveState="live" />

      <div className="space-y-3 px-3 py-3 sm:px-4">
        <section className="border hairline border-line bg-surface/60 px-3 py-4">
          <div className="flex items-center gap-2">
            <ModuleIcon name="Trees" className="size-5 text-muted" />
            <h1 className="text-[13px] font-semibold tracking-[0.16em] text-fg uppercase">
              Outdoor
            </h1>
            <span className="ml-auto text-[9px] tracking-[0.14em] text-faint uppercase">
              Planned
            </span>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-muted">{outdoor?.note}</p>
        </section>

        <section className="border hairline border-line bg-surface/40 px-3 py-2.5">
          <h2 className="micro micro-bright">Roadmap</h2>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {FUTURE_MODULES.map((module) => (
              <li key={module.id} className="flex items-center gap-2 text-[12px] text-muted">
                <ModuleIcon name={module.icon} className="size-3.5 text-faint" />
                {module.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="border hairline border-line bg-surface/40 px-3 py-2.5">
          <h2 className="micro micro-bright">How a module is added</h2>
          <ol className="mt-2 space-y-1.5 text-[11px] leading-snug text-muted">
            <li>
              1. Add a provider under <code className="text-fg">lib/</code> that
              fetches the data and normalises it.
            </li>
            <li>
              2. Add a service that wraps it in a{" "}
              <code className="text-fg">ModuleSnapshot</code> — data, status,
              timestamp, sources, alerts and a one-line summary.
            </li>
            <li>
              3. Register it in{" "}
              <code className="text-fg">lib/modules/registry.ts</code> for
              navigation and section ordering.
            </li>
            <li>
              4. Fetch it in{" "}
              <code className="text-fg">lib/intelligence/commandCenter.ts</code>{" "}
              and the day status, briefing and Alert Center pick it up.
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
