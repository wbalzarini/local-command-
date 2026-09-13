import { formatTime } from "@/lib/format";
import type { Alert } from "@/types";

/**
 * The critical-alert banner.
 *
 * This is the one component allowed to break the dashboard's hierarchy. An
 * active tornado or flash-flood warning is not a card among cards, so when
 * one is in effect it goes above everything — above the briefing, above the
 * day status — with the issuing office and the expiry time, and a link to the
 * full product because a warning's instructions matter more than any summary
 * of them.
 */
export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-2" role="alert">
      {alerts.map((alert) => (
        <section
          key={alert.id}
          className="animate-slide border border-level-severe-dim bg-level-severe-dim/30 px-3 py-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-[13px] font-semibold tracking-wide text-level-severe uppercase">
              {alert.title}
            </h2>
            {alert.expiresAt ? (
              <span className="tnum font-mono text-[11px] text-level-severe">
                until {formatTime(alert.expiresAt)}
              </span>
            ) : null}
          </div>

          {alert.area ? (
            <p className="mt-1 text-[11px] text-muted">{alert.area}</p>
          ) : null}

          {alert.body ? (
            <p className="mt-1.5 text-[12px] leading-snug text-fg">{alert.body}</p>
          ) : null}

          <p className="mt-2 text-[10px] tracking-wide text-faint uppercase">
            {alert.source.name}
            {alert.issuedAt ? ` · issued ${formatTime(alert.issuedAt)}` : ""}
            {alert.source.url ? (
              <>
                {" · "}
                <a
                  href={alert.source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-level-severe-dim underline-offset-2"
                >
                  Full alert
                </a>
              </>
            ) : null}
          </p>
        </section>
      ))}
    </div>
  );
}
