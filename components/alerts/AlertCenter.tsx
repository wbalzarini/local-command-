"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardCard, EmptyState } from "@/components/ui/primitives";
import { PRIORITY_LABELS } from "@/lib/alerts/engine";
import { formatAgo, formatTime } from "@/lib/format";
import type { Alert, AlertSeverity } from "@/types";

/**
 * The Alert Center.
 *
 * One list for weather, traffic, roads and public safety, ordered by the
 * priority each module assigned — immediate safety first, general information
 * last. The severity filter is a filter, not a sort: the ordering is the
 * intelligence layer's and is not up for negotiation in the UI, because an
 * interface that lets you sort a tornado warning below a road closure is a
 * worse interface.
 *
 * Dismissals are per-session and per-alert-id. They are deliberately not
 * persisted: an alert dismissed yesterday and re-issued today is new
 * information.
 */

const SEVERITY_STYLE: Record<AlertSeverity, { dot: string; text: string; label: string }> = {
  critical: { dot: "bg-level-severe", text: "text-level-severe", label: "Critical" },
  important: { dot: "bg-level-poor", text: "text-level-poor", label: "Important" },
  advisory: { dot: "bg-level-moderate", text: "text-level-moderate", label: "Advisory" },
  info: { dot: "bg-level-good", text: "text-level-good", label: "Information" },
};

const FILTERS: { value: AlertSeverity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "advisory", label: "Advisory" },
];

export function AlertCenter({
  alerts,
  counts,
  compact = false,
}: {
  alerts: Alert[];
  counts?: Record<AlertSeverity, number>;
  /** Today's card shows the top few; the Alerts page shows everything. */
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const live = alerts.filter((alert) => !dismissed.includes(alert.id));
    const filtered = filter === "all" ? live : live.filter((alert) => alert.severity === filter);
    return compact ? filtered.slice(0, 4) : filtered;
  }, [alerts, dismissed, filter, compact]);

  return (
    <DashboardCard
      title="Alert Center"
      subtitle={
        counts
          ? `${counts.critical} critical · ${counts.important} important · ${counts.advisory} advisory`
          : undefined
      }
      right={
        compact ? null : (
          <div className="flex border hairline border-line" role="group" aria-label="Filter alerts">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={`px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${
                  filter === option.value ? "bg-raised text-fg" : "text-faint hover:text-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )
      }
    >
      {visible.length === 0 ? (
        <EmptyState>
          {alerts.length === 0
            ? "No active alerts across weather, commute, roads or public safety."
            : "Nothing matches this filter."}
        </EmptyState>
      ) : (
        <ul className="space-y-0">
          {visible.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            const open = expanded === alert.id;

            return (
              <li key={alert.id} className="border-b hairline border-line/60 py-2 last:border-0">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${style.dot}`}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${style.text}`}>
                        {style.label}
                      </span>
                      <span className="text-[9px] tracking-[0.12em] text-faint uppercase">
                        {PRIORITY_LABELS[alert.priority]}
                      </span>
                      {alert.issuedAt ? (
                        <span className="tnum font-mono text-[10px] text-faint">
                          {formatAgo(alert.issuedAt)}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-0.5 text-[13px] leading-snug text-fg">{alert.title}</p>

                    {open && alert.body ? (
                      <p className="animate-fade mt-1 text-[12px] leading-snug text-muted">
                        {alert.body}
                      </p>
                    ) : null}

                    {open ? (
                      <p className="mt-1.5 text-[10px] text-faint">
                        {alert.area ? `${alert.area} · ` : ""}
                        {alert.source.name}
                        {alert.expiresAt ? ` · until ${formatTime(alert.expiresAt)}` : ""}
                        {alert.source.url ? (
                          <>
                            {" · "}
                            <a
                              href={alert.source.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="underline decoration-line underline-offset-2"
                            >
                              Source
                            </a>
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {alert.body || alert.source.url ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : alert.id)}
                        aria-expanded={open}
                        aria-label={open ? "Collapse alert" : "Expand alert"}
                        className="p-1 text-faint transition-colors hover:text-fg"
                      >
                        <ChevronDown
                          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDismissed((ids) => [...ids, alert.id])}
                      className="p-1 text-[10px] tracking-wide text-faint uppercase transition-colors hover:text-fg"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {compact && alerts.length > visible.length ? (
        <p className="mt-2 text-[10px] text-faint">
          {alerts.length - visible.length} more in the Alerts module.
        </p>
      ) : null}
    </DashboardCard>
  );
}
