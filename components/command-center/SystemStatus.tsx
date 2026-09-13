import { formatTime } from "@/lib/format";
import type { ModuleHealth } from "@/lib/intelligence/commandCenter";
import type { DataState } from "@/types";

/**
 * The data-reliability strip.
 *
 * Every module reports its own state, and this shows all of them at once, so
 * "why does the commute card look odd" has an answer on screen rather than in
 * a console. A module that has never succeeded is the one case worth calling
 * out in words, which is what the trailing note does.
 */

const STATE_STYLE: Record<DataState, { label: string; className: string }> = {
  ok: { label: "ONLINE", className: "text-level-good" },
  stale: { label: "STALE", className: "text-level-moderate" },
  degraded: { label: "PARTIAL", className: "text-level-moderate" },
  unavailable: { label: "OFFLINE", className: "text-level-severe" },
  demo: { label: "DEMO", className: "text-warn" },
  locked: { label: "LOCKED", className: "text-level-unknown" },
};

export function SystemStatus({
  modules,
  generatedAt,
}: {
  modules: ModuleHealth[];
  generatedAt: number;
}) {
  const failing = modules.filter(
    (module) => module.state === "unavailable" && !module.lastSuccessAt,
  );

  return (
    <section className="border hairline border-line bg-surface/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="micro">Last updated</span>
        <span className="tnum font-mono text-[12px] text-fg">{formatTime(generatedAt)}</span>

        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {modules.map((module) => {
            const style = STATE_STYLE[module.state];
            return (
              <span
                key={module.id}
                className="flex items-center gap-1.5 text-[10px]"
                title={module.message ?? `${module.label}: ${style.label}`}
              >
                <span className="tracking-[0.1em] text-faint uppercase">
                  {module.label}
                </span>
                <span className={`font-semibold tracking-[0.08em] ${style.className}`}>
                  {style.label}
                </span>
              </span>
            );
          })}
        </span>
      </div>

      {failing.length ? (
        <p className="mt-1.5 border-l-2 border-level-severe pl-2 text-[11px] leading-snug text-level-severe">
          {failing.map((module) => module.message ?? `${module.label} unavailable.`).join(" ")}
        </p>
      ) : null}
    </section>
  );
}
