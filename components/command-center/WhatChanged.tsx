import {
  ArrowDown,
  ArrowUp,
  Car,
  Droplets,
  Gauge,
  ShieldAlert,
  Thermometer,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { DashboardCard, EmptyState } from "@/components/ui/primitives";
import { formatAgo } from "@/lib/format";
import type { ChangeItem, ChangeKind, WhatChanged as WhatChangedData } from "@/lib/intelligence/snapshot";

/**
 * "What Changed?"
 *
 * Ordered by the magnitude the intelligence layer assigned, so a newly issued
 * warning or a ten-minute traffic swing is at the top and a two-degree
 * revision does not appear at all. Each row states what it was compared
 * against, because "+4°" means one thing against yesterday and quite another
 * against the forecast from an hour ago.
 */

const ICONS: Record<ChangeKind, LucideIcon> = {
  temperature: Thermometer,
  rain: Droplets,
  pressure: Gauge,
  commute: Car,
  alert: TriangleAlert,
  "air-quality": Wind,
  "public-safety": ShieldAlert,
  road: Car,
};

export function WhatChanged({ data }: { data: WhatChangedData }) {
  return (
    <DashboardCard
      title="What Changed?"
      subtitle={
        data.bases.length
          ? `Compared against ${data.bases.join(" and ")}`
          : "No earlier reading to compare against yet"
      }
      right={
        data.comparedAt ? (
          <span className="tnum font-mono text-[10px] text-faint">
            {formatAgo(data.comparedAt)}
          </span>
        ) : null
      }
    >
      {data.changes.length === 0 ? (
        <EmptyState>
          {data.comparedAt
            ? "Nothing has changed significantly since the last reading."
            : "This is the first reading in this session. Changes appear here once there is something to compare against."}
        </EmptyState>
      ) : (
        <ul className="space-y-0">
          {data.changes.map((change) => (
            <ChangeRow key={change.id} change={change} />
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

function ChangeRow({ change }: { change: ChangeItem }) {
  const Icon = ICONS[change.kind];
  const rising = change.delta !== null && change.delta > 0;
  const falling = change.delta !== null && change.delta < 0;

  // Emphasis scales with the magnitude the intelligence layer assigned, so the
  // most consequential row is also the loudest one.
  const strong = change.magnitude >= 0.6;

  return (
    <li className="flex items-start gap-2.5 border-b hairline border-line/60 py-2 last:border-0">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${strong ? "text-fg" : "text-faint"}`}
        strokeWidth={1.75}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11px] tracking-wide text-faint uppercase">
            {change.label}
          </span>

          <span className="tnum flex items-baseline gap-1.5 font-mono text-[13px]">
            {change.from ? (
              <>
                <span className="text-faint">{change.from}</span>
                <span className="text-line-strong" aria-hidden="true">
                  →
                </span>
              </>
            ) : null}
            <span className={strong ? "text-fg" : "text-muted"}>{change.to}</span>
          </span>

          {change.delta !== null ? (
            <span
              className={`tnum inline-flex items-center gap-0.5 font-mono text-[11px] ${
                rising ? "text-level-moderate" : falling ? "text-series-pressure" : "text-muted"
              }`}
            >
              {rising ? (
                <ArrowUp className="size-3" aria-hidden="true" />
              ) : falling ? (
                <ArrowDown className="size-3" aria-hidden="true" />
              ) : null}
              {formatDelta(change)}
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 text-[10px] text-faint">{change.basis}</p>
      </div>
    </li>
  );
}

function formatDelta(change: ChangeItem): string {
  if (change.delta === null) return "";
  const magnitude = Math.abs(change.delta);
  // Pressure moves in hundredths; everything else rounds to whole units.
  const value = change.kind === "pressure" ? magnitude.toFixed(2) : String(Math.round(magnitude));
  return `${change.delta > 0 ? "+" : "−"}${value}`;
}
