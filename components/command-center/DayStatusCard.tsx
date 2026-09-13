import { DashboardCard, LEVEL_DOT, LEVEL_TEXT, StatusBadge } from "@/components/ui/primitives";
import { STATUS_LABEL } from "@/lib/format";
import type { DayStatus } from "@/types";

/**
 * The day status, and the working behind it.
 *
 * The score is shown with the points each category contributed, because an
 * opaque number badged "MODERATE" is worth nothing — you cannot act on it, and
 * you cannot tell whether it disagrees with you. Showing the arithmetic also
 * keeps the model honest: a category that cannot be checked reports UNKNOWN and
 * zero points, which is visible here rather than silently counted as good.
 */
export function DayStatusCard({ status }: { status: DayStatus }) {
  return (
    <DashboardCard
      title="Day Status"
      right={<StatusBadge level={status.level} label={status.label} />}
      footer={
        <p className="text-[10px] leading-snug text-faint">
          Convenience indicator, not an authoritative index. Score {status.score}/100 is
          the sum of the points below.
        </p>
      }
    >
      <p className="text-[13px] leading-snug text-fg">{status.headline}</p>

      <dl className="mt-3 space-y-0">
        {status.categories.map((category) => (
          <div
            key={category.key}
            className="flex items-baseline gap-2 border-b hairline border-line/60 py-1.5 last:border-0"
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[category.level]}`}
              aria-hidden="true"
            />
            <dt className="w-28 shrink-0 text-[11px] tracking-wide text-faint uppercase">
              {category.label}
            </dt>
            <dd className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[12px] text-muted" title={category.detail}>
                {category.detail}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span
                  className={`text-[10px] font-semibold tracking-[0.1em] ${LEVEL_TEXT[category.level]}`}
                >
                  {STATUS_LABEL[category.level]}
                </span>
                <span className="tnum w-6 text-right font-mono text-[11px] text-faint">
                  {category.points > 0 ? `+${category.points}` : "0"}
                </span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </DashboardCard>
  );
}
