"use client";

import { useId, useMemo } from "react";

/**
 * Hand-rolled SVG charts.
 *
 * No charting library. The dashboard draws five shapes — a line, a filled
 * line, bars, a high/low range and a sparkline — and each is a dozen lines of
 * path maths. A charting dependency would be larger than the rest of the
 * client bundle and would still need fighting to look like a terminal rather
 * than a slide deck.
 *
 * All of them are drawn in a fixed viewBox and scaled by CSS, with
 * non-scaling strokes so a wide chart does not end up with fat lines.
 */

export type ChartPoint = { x: number; y: number | null };

export type ChartSeries = {
  key: string;
  points: ChartPoint[];
  /** A CSS colour, normally one of the --color-series-* tokens. */
  color: string;
  /** Fills the area under the line with a fading gradient. */
  fill?: boolean;
  dashed?: boolean;
  width?: number;
};

const VIEW_WIDTH = 600;

type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

function bounds(series: ChartSeries[], padY: number, domainY?: [number, number]): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const entry of series) {
    for (const point of entry.points) {
      xs.push(point.x);
      if (point.y !== null) ys.push(point.y);
    }
  }

  if (!xs.length) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };

  const minY = domainY ? domainY[0] : Math.min(...ys);
  const maxY = domainY ? domainY[1] : Math.max(...ys);
  // A flat series would otherwise divide by zero and vanish.
  const span = maxY - minY || 1;

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs) || 1,
    minY: domainY ? minY : minY - span * padY,
    maxY: domainY ? maxY : maxY + span * padY,
  };
}

/**
 * A line chart with optional fill, gridlines, a "now" marker and x labels.
 *
 * Gaps are honoured: a null y breaks the path rather than interpolating across
 * it, so a missing hour of provider data looks missing instead of smooth.
 */
export function LineChart({
  series,
  height = 120,
  domainY,
  xLabels = [],
  yTicks = 3,
  formatY = (value: number) => String(Math.round(value)),
  nowX,
  className = "",
  ariaLabel,
}: {
  series: ChartSeries[];
  height?: number;
  domainY?: [number, number];
  xLabels?: { x: number; label: string }[];
  yTicks?: number;
  formatY?: (value: number) => string;
  /** Draws a vertical rule where the observed data ends and forecast begins. */
  nowX?: number;
  className?: string;
  ariaLabel: string;
}) {
  const gradientId = useId();
  const box = bounds(series, 0.12, domainY);

  const padding = { left: 34, right: 6, top: 8, bottom: xLabels.length ? 16 : 6 };
  const plotWidth = VIEW_WIDTH - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const toX = (value: number) =>
    padding.left +
    ((value - box.minX) / (box.maxX - box.minX || 1)) * plotWidth;
  const toY = (value: number) =>
    padding.top +
    plotHeight -
    ((value - box.minY) / (box.maxY - box.minY || 1)) * plotHeight;

  const ticks = useMemo(() => {
    const step = (box.maxY - box.minY) / Math.max(1, yTicks - 1);
    return Array.from({ length: yTicks }, (_, index) => box.minY + index * step);
  }, [box.minY, box.maxY, yTicks]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      className={`w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <defs>
        {series
          .filter((entry) => entry.fill)
          .map((entry) => (
            <linearGradient
              key={entry.key}
              id={`${gradientId}-${entry.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
            </linearGradient>
          ))}
      </defs>

      {ticks.map((tick, index) => (
        <g key={index}>
          <line
            x1={padding.left}
            x2={VIEW_WIDTH - padding.right}
            y1={toY(tick)}
            y2={toY(tick)}
            stroke="currentColor"
            strokeWidth="1"
            className="text-line/50"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={padding.left - 5}
            y={toY(tick) + 3}
            textAnchor="end"
            className="fill-faint font-mono"
            style={{ fontSize: 9 }}
          >
            {formatY(tick)}
          </text>
        </g>
      ))}

      {nowX !== undefined ? (
        <line
          x1={toX(nowX)}
          x2={toX(nowX)}
          y1={padding.top}
          y2={padding.top + plotHeight}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          className="text-line-strong"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {series.map((entry) => {
        const segments = splitSegments(entry.points);
        return (
          <g key={entry.key}>
            {entry.fill
              ? segments.map((segment, index) => (
                  <path
                    key={`fill-${index}`}
                    d={areaPath(segment, toX, toY, padding.top + plotHeight)}
                    fill={`url(#${gradientId}-${entry.key})`}
                  />
                ))
              : null}
            {segments.map((segment, index) => (
              <path
                key={`line-${index}`}
                d={linePath(segment, toX, toY)}
                fill="none"
                stroke={entry.color}
                strokeWidth={entry.width ?? 1.75}
                strokeDasharray={entry.dashed ? "4 3" : undefined}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}

      {xLabels.map((label, index) => (
        <text
          key={index}
          x={toX(label.x)}
          y={height - 4}
          textAnchor="middle"
          className="fill-faint font-mono"
          style={{ fontSize: 9 }}
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
}

/** Vertical bars, for rain probability and precipitation totals. */
export function BarChart({
  points,
  height = 80,
  color,
  max,
  xLabels = [],
  formatValue,
  ariaLabel,
}: {
  points: { x: number; y: number | null; highlight?: boolean }[];
  height?: number;
  color: string;
  /** Fixed top of the scale, e.g. 100 for a percentage. */
  max?: number;
  xLabels?: { x: number; label: string }[];
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  const padding = { left: 4, right: 4, top: 10, bottom: xLabels.length ? 14 : 2 };
  const plotWidth = VIEW_WIDTH - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const ceiling = max ?? Math.max(1, ...points.map((point) => point.y ?? 0));
  const slot = plotWidth / Math.max(1, points.length);
  const barWidth = Math.max(2, slot * 0.62);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {points.map((point, index) => {
        if (point.y === null) return null;
        const barHeight = Math.max(0, (point.y / ceiling) * plotHeight);
        const x = padding.left + index * slot + (slot - barWidth) / 2;
        return (
          <rect
            key={index}
            x={x}
            y={padding.top + plotHeight - barHeight}
            width={barWidth}
            height={barHeight}
            fill={color}
            opacity={point.highlight ? 1 : 0.55}
          />
        );
      })}

      {formatValue
        ? points.map((point, index) =>
            point.highlight && point.y !== null ? (
              <text
                key={`label-${index}`}
                x={padding.left + index * slot + slot / 2}
                y={padding.top - 2}
                textAnchor="middle"
                className="fill-muted font-mono"
                style={{ fontSize: 9 }}
              >
                {formatValue(point.y)}
              </text>
            ) : null,
          )
        : null}

      {xLabels.map((label, index) => (
        <text
          key={`x-${index}`}
          x={padding.left + label.x * slot + slot / 2}
          y={height - 3}
          textAnchor="middle"
          className="fill-faint font-mono"
          style={{ fontSize: 9 }}
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
}

/**
 * High/low range bars for the ten-day forecast.
 *
 * One row per day, each a bar spanning that day's low to its high on a shared
 * scale — which makes a cold snap four days out visible as a shift in the bars
 * rather than as two numbers you have to compare in your head.
 */
export function RangeBars({
  rows,
  ariaLabel,
}: {
  rows: { label: string; low: number; high: number; accent?: boolean }[];
  ariaLabel: string;
}) {
  if (!rows.length) return null;

  const min = Math.min(...rows.map((row) => row.low));
  const max = Math.max(...rows.map((row) => row.high));
  const span = max - min || 1;

  return (
    <div className="space-y-1" role="img" aria-label={ariaLabel}>
      {rows.map((row) => {
        const left = ((row.low - min) / span) * 100;
        const width = Math.max(2, ((row.high - row.low) / span) * 100);
        return (
          <div key={row.label} className="flex items-center gap-2">
            <span className="tnum w-10 shrink-0 font-mono text-[11px] text-faint">
              {row.label}
            </span>
            <span className="tnum w-7 shrink-0 text-right font-mono text-[11px] text-series-pressure">
              {Math.round(row.low)}
            </span>
            <span className="relative h-1.5 flex-1 bg-raised">
              <span
                className={`absolute inset-y-0 rounded-full ${
                  row.accent ? "bg-series-temp" : "bg-series-temp/55"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </span>
            <span className="tnum w-7 shrink-0 font-mono text-[11px] text-series-temp">
              {Math.round(row.high)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Inline sparkline, for the metric rows in the trend table. */
export function Sparkline({
  values,
  color,
  height = 18,
  width = 64,
}: {
  values: (number | null)[];
  color: string;
  height?: number;
  width?: number;
}) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length < 2) return null;

  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;

  const path = values
    .map((value, index) => {
      if (value === null) return null;
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter((entry): entry is string => entry !== null)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Splits a series at nulls, so gaps in provider data are drawn as gaps. */
function splitSegments(points: ChartPoint[]): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  for (const point of points) {
    if (point.y === null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x: point.x, y: point.y });
  }

  if (current.length) segments.push(current);
  return segments.filter((segment) => segment.length > 1);
}

function linePath(
  points: { x: number; y: number }[],
  toX: (value: number) => number,
  toY: (value: number) => number,
): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${toX(point.x).toFixed(2)} ${toY(point.y).toFixed(2)}`)
    .join(" ");
}

function areaPath(
  points: { x: number; y: number }[],
  toX: (value: number) => number,
  toY: (value: number) => number,
  baseline: number,
): string {
  const line = linePath(points, toX, toY);
  const first = toX(points[0].x).toFixed(2);
  const last = toX(points[points.length - 1].x).toFixed(2);
  return `${line} L${last} ${baseline} L${first} ${baseline} Z`;
}
