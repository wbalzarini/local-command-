import { formatTime } from "@/lib/format";
import type { Briefing } from "@/lib/intelligence/briefing";

/**
 * Today at a glance.
 *
 * Sits at the very top because it is the thing that answers the question this
 * dashboard exists for. The `unavailable` list is rendered, not hidden: a
 * briefing that silently omits the traffic sentence reads as "traffic is
 * fine", and that is the failure mode most worth designing against here.
 */
export function DailyBriefing({ briefing }: { briefing: Briefing }) {
  return (
    <section className="animate-slide border hairline border-line bg-surface/70">
      <header className="flex items-baseline justify-between gap-3 border-b hairline border-line px-3 py-2">
        <h2 className="micro micro-bright">Today at a Glance</h2>
        <span className="tnum font-mono text-[10px] text-faint">
          {formatTime(briefing.generatedAt)}
        </span>
      </header>

      <div className="space-y-2 px-3 py-3">
        <p className="text-[13px] font-medium text-fg">{briefing.greeting}</p>

        {briefing.paragraphs.map((paragraph, index) => (
          <p key={index} className="text-[13px] leading-relaxed text-muted">
            {paragraph}
          </p>
        ))}

        {briefing.unavailable.length ? (
          <div className="mt-3 space-y-1 border-l-2 border-level-moderate pl-2">
            {briefing.unavailable.map((note, index) => (
              <p key={index} className="text-[11px] leading-snug text-level-moderate">
                {note}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="border-t hairline border-line px-3 py-1.5">
        <p className="text-[10px] leading-snug text-faint">
          Assembled from retrieved data only. Anything that could not be
          retrieved is named above rather than omitted.
        </p>
      </footer>
    </section>
  );
}
