"use client";

import { DashboardCard, EmptyState, LEVEL_DOT, StateBlock } from "@/components/ui/primitives";
import { PasscodeGate } from "@/components/commute/PasscodeGate";
import { formatTime } from "@/lib/format";
import type { RoadsData } from "@/lib/traffic/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Road conditions along the commute.
 *
 * The empty state is the important part of this component. When a feed is
 * configured and reports nothing, the card says "no issues reported by
 * PennDOT" — a statement about the feed, not about the asphalt. When no feed
 * is configured it says that instead. Neither is ever rendered as "roads are
 * clear", which would be a claim this module cannot make.
 */
export function RoadConditions({
  roads,
  onUnlocked,
}: {
  roads: ModuleSnapshot<RoadsData>;
  onUnlocked: () => void;
}) {
  const data = roads.data;

  if (roads.status.state === "locked") {
    return (
      <DashboardCard title="Road Conditions" status={roads.status} id="roads">
        <PasscodeGate onUnlocked={onUnlocked} />
      </DashboardCard>
    );
  }

  if (!data) {
    return (
      <DashboardCard title="Road Conditions" status={roads.status} sources={roads.sources} id="roads">
        <StateBlock
          state={roads.status.state === "ok" ? "unavailable" : roads.status.state}
          message={roads.status.message}
          lastSuccessAt={roads.status.lastSuccessAt}
          label="Road condition"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Road Conditions"
      subtitle={data.configured ? data.agency : "No feed configured"}
      status={roads.status}
      sources={roads.sources}
      id="roads"
    >
      {!data.configured ? (
        <p className="border-l-2 border-level-unknown pl-2 text-[12px] leading-snug text-faint">
          {roads.status.message ??
            "No road-condition feed is configured, so closures, construction and restrictions are not being monitored. This is not a statement that the roads are clear."}
        </p>
      ) : (
        <>
          <dl className="space-y-0">
            {data.conditions.map((condition) => (
              <div
                key={condition.label}
                className="flex items-baseline gap-2 border-b hairline border-line/60 py-1.5 last:border-0"
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[condition.level]}`}
                  aria-hidden="true"
                />
                <dt className="w-28 shrink-0 text-[11px] tracking-wide text-faint uppercase">
                  {condition.label}
                </dt>
                <dd className="min-w-0 flex-1 text-[12px] text-muted">{condition.detail}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3">
            <h3 className="micro">Closures &amp; restrictions</h3>
            {data.closures.length === 0 ? (
              <EmptyState>
                None reported by {data.agency} near your route.
              </EmptyState>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {data.closures.map((closure) => (
                  <li key={closure.id} className="border hairline border-line px-2 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold tracking-[0.1em] text-level-moderate uppercase">
                        {closure.type.replace("-", " ")}
                      </span>
                      {closure.reportedAt ? (
                        <span className="tnum font-mono text-[10px] text-faint">
                          {formatTime(closure.reportedAt)}
                        </span>
                      ) : null}
                    </div>
                    {closure.location ? (
                      <p className="mt-0.5 text-[11px] text-fg">{closure.location}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">
                      {closure.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
