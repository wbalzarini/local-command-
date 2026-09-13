"use client";

import { ExternalLink, ShieldAlert } from "lucide-react";
import { DashboardCard, StateBlock } from "@/components/ui/primitives";
import { SourceStatusList } from "./SourceStatusList";
import { formatAgo, formatTime } from "@/lib/format";
import { NO_CHECKPOINTS_FOUND } from "@/lib/sources/types";
import type { CheckpointAnnouncement, PublicSafetyData } from "@/lib/sources/types";
import type { ModuleSnapshot } from "@/types";

/**
 * Public safety: an aggregator of published announcements.
 *
 * Three things this component will not do, each of them deliberate:
 *
 *  - It never says there are no checkpoints. It says nothing was found in the
 *    monitored sources, which is a different and truthful claim, and it carries
 *    the disclaimer to that effect next to the result rather than in a footer
 *    someone might not reach.
 *  - It never shows a field the announcement did not state. A checkpoint with
 *    no published time shows "not stated in announcement", not a guess.
 *  - It always links the original announcement, so every line here can be
 *    checked against the agency that published it.
 *
 * How many sources answered is shown alongside the result, because "nothing
 * found across nine sources" and "nothing found because eight failed" look
 * identical otherwise.
 */
export function PublicSafetyPanel({
  publicSafety,
  compact = false,
}: {
  publicSafety: ModuleSnapshot<PublicSafetyData>;
  compact?: boolean;
}) {
  const data = publicSafety.data;

  if (!data) {
    return (
      <DashboardCard title="Public Safety" status={publicSafety.status} sources={publicSafety.sources}>
        <StateBlock
          state={publicSafety.status.state === "ok" ? "unavailable" : publicSafety.status.state}
          message={publicSafety.status.message}
          lastSuccessAt={publicSafety.status.lastSuccessAt}
          label="Public safety"
        />
      </DashboardCard>
    );
  }

  const unreachable = data.sourcesFailed > 0;
  // When nothing could be read, "nothing found in monitored sources" is the
  // wrong headline even with a caveat attached: no source was monitored on
  // this check. The two cases get different copy rather than one with an
  // asterisk.
  const allFailed = data.sourcesChecked > 0 && data.sourcesFailed === data.sourcesChecked;

  return (
    <DashboardCard
      title="Public Safety"
      subtitle="Publicly announced DUI / sobriety checkpoints — Chester County, PA"
      status={publicSafety.status}
      right={
        <span className="tnum font-mono text-[10px] text-faint">
          {data.sourcesChecked - data.sourcesFailed}/{data.sourcesChecked} sources
        </span>
      }
      footer={
        <p className="text-[10px] leading-snug text-faint">
          Aggregates public announcements only. It does not infer unannounced
          enforcement, and contains no guidance on avoiding it.
        </p>
      }
    >
      {data.checkpoints.length === 0 ? (
        <div className="flex items-start gap-2 py-1">
          <ShieldAlert
            className={`mt-0.5 size-4 shrink-0 ${
              allFailed ? "text-level-severe" : unreachable ? "text-level-moderate" : "text-level-good"
            }`}
            aria-hidden="true"
          />
          <div>
            <p className="text-[13px] leading-snug text-fg">
              {allFailed
                ? "No monitored source could be reached on this check, so no announcement information is available."
                : NO_CHECKPOINTS_FOUND}
            </p>
            {unreachable && !allFailed ? (
              <p className="mt-1 text-[11px] leading-snug text-level-moderate">
                {data.sourcesFailed} of {data.sourcesChecked} monitored sources could not be
                reached on this check, so this result is incomplete.
              </p>
            ) : null}
            {allFailed ? (
              <p className="mt-1 text-[11px] leading-snug text-level-severe">
                All {data.sourcesChecked} sources failed. This is not a statement
                that nothing was announced — see the source list below for what
                went wrong.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {(compact ? data.checkpoints.slice(0, 2) : data.checkpoints).map((checkpoint) => (
            <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} />
          ))}
        </ul>
      )}

      <p className="mt-3 border-l-2 border-level-moderate pl-2 text-[11px] leading-snug text-level-moderate">
        {data.disclaimer}
      </p>

      {!compact ? (
        <>
          {data.announcements.length ? (
            <div className="mt-4">
              <h3 className="micro">Other public safety announcements</h3>
              <ul className="mt-1.5 space-y-1.5">
                {data.announcements.map((item) => (
                  <li key={item.id} className="border hairline border-line px-2 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] tracking-[0.1em] text-faint uppercase">
                        {item.agency}
                      </span>
                      {item.publishedAt ? (
                        <span className="tnum font-mono text-[10px] text-faint">
                          {formatAgo(item.publishedAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12px] leading-snug text-fg">{item.title}</p>
                    {item.excerpt ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.excerpt}</p>
                    ) : null}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-flex items-center gap-1 text-[10px] tracking-wide text-info uppercase"
                    >
                      View source <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4">
            <h3 className="micro">Monitored sources</h3>
            <SourceStatusList sources={data.sources} />
          </div>
        </>
      ) : null}
    </DashboardCard>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: CheckpointAnnouncement }) {
  return (
    <li className="border border-level-moderate-dim bg-level-moderate-dim/15 px-2.5 py-2">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-level-moderate uppercase">
        Publicly announced sobriety checkpoint
      </h3>

      <p className="mt-1.5 text-[13px] leading-snug text-fg">{checkpoint.title}</p>

      <dl className="mt-2 space-y-1 text-[11px]">
        <Field label="Date" value={checkpoint.statedDate} />
        <Field label="Time" value={checkpoint.statedTime} />
        <Field label="Area" value={checkpoint.statedArea} />
        <Field label="Agency" value={checkpoint.agency} />
        <Field
          label="Announced"
          value={checkpoint.announcedAt ? formatTime(checkpoint.announcedAt) : null}
        />
        <Field label="Source" value={checkpoint.sourceName} />
      </dl>

      {checkpoint.excerpt ? (
        <blockquote className="mt-2 border-l-2 border-level-moderate-dim pl-2 text-[11px] leading-snug text-muted">
          {checkpoint.excerpt}
        </blockquote>
      ) : null}

      <a
        href={checkpoint.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-flex items-center gap-1 border hairline border-line px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-info uppercase"
      >
        View source <ExternalLink className="size-3" />
      </a>
    </li>
  );
}

/** A field the announcement may or may not have stated. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 tracking-wide text-faint uppercase">{label}</dt>
      <dd className={`min-w-0 flex-1 ${value ? "text-fg" : "text-faint italic"}`}>
        {value ?? "not stated in announcement"}
      </dd>
    </div>
  );
}
