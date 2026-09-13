"use client";

import { formatAgo } from "@/lib/format";
import type { SourceState, SourceStatus } from "@/lib/sources/types";

/**
 * Per-source status.
 *
 * The point of showing this is that it makes "nothing found" auditable: you
 * can see which agencies were actually read, when, and which failed. A source
 * listed as `manual` has no automated reader, which is stated rather than
 * hidden — a gap you know about is manageable in a way a silent one is not.
 */

const STATE_STYLE: Record<SourceState, { label: string; className: string }> = {
  ok: { label: "OK", className: "text-level-good" },
  empty: { label: "NO ITEMS", className: "text-level-moderate" },
  error: { label: "FAILED", className: "text-level-severe" },
  disabled: { label: "OFF", className: "text-level-unknown" },
  manual: { label: "MANUAL", className: "text-level-unknown" },
};

const CATEGORY_LABEL: Record<SourceStatus["category"], string> = {
  "chester-county": "Chester County",
  pennsylvania: "Pennsylvania",
  local: "Local",
};

export function SourceStatusList({ sources }: { sources: SourceStatus[] }) {
  const grouped = (["chester-county", "pennsylvania", "local"] as const).map((category) => ({
    category,
    items: sources.filter((source) => source.category === category),
  }));

  return (
    <div className="mt-1.5 space-y-3">
      {grouped.map((group) =>
        group.items.length ? (
          <div key={group.category}>
            <h4 className="text-[9px] font-semibold tracking-[0.14em] text-faint uppercase">
              {CATEGORY_LABEL[group.category]}
            </h4>

            <ul className="mt-1">
              {group.items.map((source) => {
                const style = STATE_STYLE[source.state];
                return (
                  <li
                    key={source.id}
                    className="flex items-baseline gap-2 border-b hairline border-line/60 py-1 last:border-0"
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="min-w-0 flex-1 truncate text-[11px] text-muted underline decoration-line underline-offset-2 hover:text-fg"
                      title={source.note ?? source.name}
                    >
                      {source.name}
                    </a>

                    {source.matches > 0 ? (
                      <span className="tnum shrink-0 font-mono text-[10px] text-info">
                        {source.matches}
                      </span>
                    ) : null}

                    <span className="shrink-0 text-[9px] text-faint uppercase">
                      {source.transport}
                    </span>

                    <span
                      className={`shrink-0 text-[9px] font-semibold tracking-[0.1em] ${style.className}`}
                      title={source.message}
                    >
                      {style.label}
                    </span>

                    <span className="tnum w-16 shrink-0 text-right font-mono text-[9px] text-faint">
                      {source.lastCheckedAt ? formatAgo(source.lastCheckedAt) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
