import type { ReactNode } from "react";
import type { DataState, ModuleStatus, SourceRef, StatusLevel } from "@/types";
import { formatAgo, formatTime, STATUS_LABEL } from "@/lib/format";

/**
 * The shared vocabulary of the interface.
 *
 * Every module is built from these, which is what makes an eight-module
 * dashboard read as one instrument rather than eight. In particular the status
 * and source components are used everywhere by design: a number on this screen
 * should never appear without its state and its provenance nearby.
 */

export const LEVEL_TEXT: Record<StatusLevel, string> = {
  good: "text-level-good",
  moderate: "text-level-moderate",
  poor: "text-level-poor",
  severe: "text-level-severe",
  unknown: "text-level-unknown",
};

export const LEVEL_BORDER: Record<StatusLevel, string> = {
  good: "border-level-good-dim",
  moderate: "border-level-moderate-dim",
  poor: "border-level-poor-dim",
  severe: "border-level-severe-dim",
  unknown: "border-level-unknown-dim",
};

export const LEVEL_BG: Record<StatusLevel, string> = {
  good: "bg-level-good-dim/25",
  moderate: "bg-level-moderate-dim/25",
  poor: "bg-level-poor-dim/25",
  severe: "bg-level-severe-dim/30",
  unknown: "bg-level-unknown-dim/25",
};

export const LEVEL_DOT: Record<StatusLevel, string> = {
  good: "bg-level-good",
  moderate: "bg-level-moderate",
  poor: "bg-level-poor",
  severe: "bg-level-severe",
  unknown: "bg-level-unknown",
};

/** A block on the dashboard. Title, optional right-hand slot, body, footer. */
export function DashboardCard({
  title,
  subtitle,
  right,
  children,
  status,
  sources,
  footer,
  className = "",
  id,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  status?: ModuleStatus;
  sources?: SourceRef[];
  footer?: ReactNode;
  className?: string;
  id?: string;
  /** `critical` is reserved for blocks hoisted by an active warning. */
  tone?: "default" | "critical";
}) {
  return (
    <section
      id={id}
      className={`animate-fade border bg-surface/60 ${
        tone === "critical" ? "border-level-severe-dim" : "hairline border-line"
      } ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b hairline border-line px-3 py-2">
        <div className="min-w-0">
          <h2 className="micro micro-bright truncate">{title}</h2>
          {subtitle ? (
            <p className="mt-1 truncate text-[11px] text-faint">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0 text-right">{right}</div> : null}
      </header>

      <div className="px-3 py-3">{children}</div>

      {status || sources?.length || footer ? (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t hairline border-line px-3 py-1.5">
          {status ? <LastUpdated status={status} /> : null}
          {sources?.length ? <SourceBadge sources={sources} /> : null}
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

/** A labelled number. The unit is separated so it can be de-emphasised. */
export function Metric({
  label,
  value,
  unit,
  sub,
  tone,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: StatusLevel;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-5xl",
  } as const;

  return (
    <div className="min-w-0">
      <div className="micro">{label}</div>
      <div
        className={`tnum mt-1 font-mono ${sizes[size]} leading-none ${
          tone ? LEVEL_TEXT[tone] : "text-fg"
        }`}
      >
        {value}
        {unit ? <span className="ml-1 text-[0.5em] text-faint">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1 text-[11px] leading-tight text-muted">{sub}</div> : null}
    </div>
  );
}

/**
 * A direction and a magnitude.
 *
 * Direction is carried by both the arrow and the colour, never by colour
 * alone, so the indicator still reads without colour vision.
 */
export function TrendIndicator({
  direction,
  children,
  emphasis = false,
}: {
  direction: "up" | "down" | "flat";
  children: ReactNode;
  /** Set when the change crossed a threshold worth noticing. */
  emphasis?: boolean;
}) {
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const colour =
    direction === "flat"
      ? "text-muted"
      : emphasis
        ? direction === "up"
          ? "text-level-moderate"
          : "text-series-pressure"
        : "text-fg";

  return (
    <span className={`tnum inline-flex items-baseline gap-1 font-mono ${colour}`}>
      <span aria-hidden="true">{arrow}</span>
      <span>{children}</span>
    </span>
  );
}

export function StatusBadge({
  level,
  label,
  size = "md",
}: {
  level: StatusLevel;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 ${
        size === "sm" ? "py-0.5 text-[10px]" : "py-1 text-[11px]"
      } font-semibold tracking-[0.12em] uppercase ${LEVEL_BORDER[level]} ${LEVEL_BG[level]} ${LEVEL_TEXT[level]}`}
    >
      <span className={`size-1.5 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />
      {label ?? STATUS_LABEL[level]}
    </span>
  );
}

/**
 * Where the data came from.
 *
 * Rendered as links wherever the source published a URL, because a source you
 * cannot open is only half a citation. Simulated sources are marked in amber
 * so sample data can never be mistaken for a reading.
 */
export function SourceBadge({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-faint">
      <span className="micro">SRC</span>
      {sources.map((source, index) => {
        const demo = source.kind === "demo";
        const body = (
          <span className={demo ? "text-warn" : "text-muted"}>
            {source.name}
            {demo ? " (simulated)" : ""}
          </span>
        );

        return (
          <span key={`${source.name}-${index}`} className="inline-flex items-center gap-1">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-line underline-offset-2 hover:decoration-muted"
              >
                {body}
              </a>
            ) : (
              body
            )}
          </span>
        );
      })}
    </span>
  );
}

const STATE_COPY: Record<DataState, { label: string; className: string }> = {
  ok: { label: "LIVE", className: "text-level-good" },
  stale: { label: "STALE", className: "text-level-moderate" },
  degraded: { label: "PARTIAL", className: "text-level-moderate" },
  unavailable: { label: "OFFLINE", className: "text-level-severe" },
  demo: { label: "DEMO DATA", className: "text-warn" },
  locked: { label: "LOCKED", className: "text-level-unknown" },
};

/** The state and freshness line that every module carries. */
export function LastUpdated({ status }: { status: ModuleStatus }) {
  const copy = STATE_COPY[status.state];

  return (
    <span className="flex items-center gap-2 text-[10px]">
      <span className={`font-semibold tracking-[0.12em] ${copy.className}`}>
        {copy.label}
      </span>
      {status.lastSuccessAt ? (
        <span className="tnum font-mono text-faint">
          {status.state === "ok"
            ? formatAgo(status.lastSuccessAt)
            : `last ok ${formatTime(status.lastSuccessAt)}`}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The four states every module needs a real answer for.
 *
 * `unavailable` deliberately reports the last successful update when there was
 * one, which is the difference between "broken" and "not right now".
 */
export function StateBlock({
  state,
  message,
  lastSuccessAt,
  label,
}: {
  state: Exclude<DataState, "ok">;
  message?: string;
  lastSuccessAt?: number;
  label: string;
}) {
  if (state === "stale" || state === "degraded" || state === "demo") {
    return (
      <p
        className={`border-l-2 pl-2 text-[11px] leading-snug ${
          state === "demo"
            ? "border-warn text-warn"
            : "border-level-moderate text-level-moderate"
        }`}
      >
        {message ?? (state === "demo" ? "Sample data." : `${label} data may be out of date.`)}
      </p>
    );
  }

  return (
    <div className="py-4 text-center">
      <p className="text-[13px] text-muted">
        {message ??
          (state === "locked"
            ? `${label} is protected on this deployment.`
            : `${label} data temporarily unavailable.`)}
      </p>
      {lastSuccessAt ? (
        <p className="tnum mt-1 font-mono text-[11px] text-faint">
          Last successful update {formatTime(lastSuccessAt)}
        </p>
      ) : null}
    </div>
  );
}

/** Skeleton rows, sized to the block they stand in for. */
export function Loading({ lines = 3, label }: { lines?: number; label?: string }) {
  return (
    <div className="animate-sweep space-y-2" role="status" aria-label={label ?? "Loading"}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-3 bg-raised"
          style={{ width: `${88 - index * 14}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-3 text-[13px] leading-snug text-muted">{children}</p>;
}

/** A two-column key/value row, the densest way to list readings. */
export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: StatusLevel;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b hairline border-line/60 py-1.5 last:border-0">
      <span className="text-[11px] tracking-wide text-faint uppercase">{label}</span>
      <span className={`tnum font-mono text-[13px] ${tone ? LEVEL_TEXT[tone] : "text-fg"}`}>
        {value}
      </span>
    </div>
  );
}

/** Segmented control, used for chart ranges. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex border hairline border-line" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          className={`px-2 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase transition-colors ${
            option.value === value
              ? "bg-raised text-fg"
              : "text-faint hover:bg-raised/50 hover:text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Checkbox styled as a terminal toggle. Used by radar layers and settings. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 appearance-none border border-line-strong bg-ink checked:border-info checked:bg-info"
      />
      <span className="min-w-0">
        <span className="block text-[12px] leading-tight text-fg">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
