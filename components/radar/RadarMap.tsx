"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as LeafletNamespace from "leaflet";
import { Pause, Play } from "lucide-react";
import { MapCanvas, type MapReady } from "@/components/ui/MapCanvas";
import { DashboardCard, StateBlock, Toggle } from "@/components/ui/primitives";
import { formatTime } from "@/lib/format";
import type { RadarData, WeatherAlert } from "@/lib/weather/types";
import type { Coordinates, ModuleSnapshot } from "@/types";

/**
 * Live radar.
 *
 * The frames come from the provider's index and the tiles are fetched by the
 * browser directly, which is the only way an animation stays smooth — proxying
 * every tile through this app would add a hop to each of a few hundred
 * requests per loop.
 *
 * Animation works by keeping every frame's layer mounted at zero opacity and
 * switching which one is visible. Adding and removing layers per frame makes
 * the loop flash white as each new layer fetches its tiles; pre-loading them
 * costs memory and buys a clean cross-fade.
 *
 * Layer toggles reflect what the provider actually publishes. Lightning is
 * offered by no keyless feed, so it is shown disabled with the reason, rather
 * than as a switch that silently does nothing.
 */

/** Milliseconds per frame while playing. */
const FRAME_MS = 420;

/** Pause at the newest frame so the loop reads as "now", then restart. */
const LOOP_PAUSE_MS = 1_400;

export function RadarMap({
  radar,
  alerts,
  center,
  height = 340,
  compact = false,
}: {
  radar: ModuleSnapshot<RadarData>;
  /** NWS alert polygons, drawn as overlays when the alert carries geometry. */
  alerts?: WeatherAlert[];
  center: Coordinates;
  height?: number;
  /** Hides the layer controls, for the Today page card. */
  compact?: boolean;
}) {
  const data = radar.data;
  const frames = useMemo(() => data?.frames ?? [], [data]);

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [layers, setLayers] = useState({
    rain: true,
    storms: true,
    satellite: false,
    alerts: true,
  });

  // Layer handles, kept outside React state: Leaflet objects are mutable and
  // re-rendering on every frame change would be wasteful and jittery.
  const radarLayers = useRef<LeafletNamespace.TileLayer[]>([]);
  const satelliteLayer = useRef<LeafletNamespace.TileLayer | null>(null);
  const alertLayer = useRef<LeafletNamespace.GeoJSON | null>(null);

  const latestIndex = Math.max(0, frames.filter((frame) => frame.past).length - 1);

  useEffect(() => {
    setFrameIndex(latestIndex);
  }, [latestIndex]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;

    const atEnd = frameIndex >= frames.length - 1;
    const timer = setTimeout(
      () => setFrameIndex((index) => (index >= frames.length - 1 ? 0 : index + 1)),
      atEnd ? LOOP_PAUSE_MS : FRAME_MS,
    );

    return () => clearTimeout(timer);
  }, [playing, frameIndex, frames.length]);

  // Show the selected frame and hide the rest.
  useEffect(() => {
    radarLayers.current.forEach((layer, index) => {
      layer.setOpacity(index === frameIndex && layers.rain ? 0.72 : 0);
    });
  }, [frameIndex, layers.rain]);

  useEffect(() => {
    const layer = satelliteLayer.current;
    if (layer) layer.setOpacity(layers.satellite ? 0.45 : 0);
  }, [layers.satellite]);

  const onReady = useCallback(
    ({ L, map }: MapReady) => {
      if (!data) return;

      radarLayers.current = data.frames.map((frame) =>
        L.tileLayer(frame.urlTemplate, {
          opacity: 0,
          maxZoom: 12,
          // Radar composites are coarse; this keeps them from being upscaled
          // into a blur at neighbourhood zooms.
          maxNativeZoom: 10,
          zIndex: 400,
        }).addTo(map),
      );

      const infrared = data.satelliteFrames.at(-1);
      if (infrared) {
        satelliteLayer.current = L.tileLayer(infrared.urlTemplate, {
          opacity: 0,
          maxZoom: 12,
          maxNativeZoom: 8,
          zIndex: 300,
        }).addTo(map);
      }

      const withGeometry = (alerts ?? []).filter((alert) => alert.geometry);
      if (withGeometry.length) {
        alertLayer.current = L.geoJSON(
          {
            type: "FeatureCollection",
            features: withGeometry.map((alert) => ({
              type: "Feature",
              geometry: alert.geometry,
              properties: { event: alert.event, severity: alert.severity },
            })),
          } as never,
          {
            style: (feature) => ({
              color:
                feature?.properties?.severity === "critical"
                  ? "var(--color-level-severe)"
                  : "var(--color-level-moderate)",
              weight: 1.5,
              fillOpacity: 0.1,
            }),
            onEachFeature: (feature, layer) => {
              layer.bindPopup(String(feature.properties?.event ?? "Weather alert"));
            },
          },
        ).addTo(map);
      }

      L.circleMarker([center.lat, center.lon], {
        radius: 4,
        color: "var(--color-info)",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip("Avondale");

      return () => {
        radarLayers.current = [];
        satelliteLayer.current = null;
        alertLayer.current = null;
      };
    },
    [data, alerts, center.lat, center.lon],
  );

  // Alert polygons toggle by adding and removing, since there is only one layer.
  useEffect(() => {
    const layer = alertLayer.current;
    if (!layer) return;
    const element = layer.getPane?.();
    void element;
    layer.setStyle({ opacity: layers.alerts ? 1 : 0, fillOpacity: layers.alerts ? 0.1 : 0 });
  }, [layers.alerts]);

  if (!data) {
    return (
      <DashboardCard title="Radar" status={radar.status} sources={radar.sources}>
        <StateBlock
          state={radar.status.state === "ok" ? "unavailable" : radar.status.state}
          message={radar.status.message}
          lastSuccessAt={radar.status.lastSuccessAt}
          label="Radar"
        />
      </DashboardCard>
    );
  }

  const frame = frames[frameIndex];

  return (
    <DashboardCard
      title="Live Radar"
      subtitle={frame ? `${frame.past ? "Observed" : "Forecast"} · ${formatTime(frame.time)}` : undefined}
      status={radar.status}
      sources={radar.sources}
      right={
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="inline-flex items-center gap-1 border hairline border-line px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-muted uppercase transition-colors hover:text-fg"
          aria-label={playing ? "Pause radar animation" : "Play radar animation"}
        >
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          {playing ? "Pause" : "Play"}
        </button>
      }
    >
      <MapCanvas
        center={[center.lat, center.lon]}
        zoom={8}
        height={height}
        onReady={onReady}
        ariaLabel="Precipitation radar centred on Avondale, Pennsylvania"
        className="border hairline border-line"
      />

      <div className="mt-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={frameIndex}
          onChange={(event) => {
            setPlaying(false);
            setFrameIndex(Number(event.target.value));
          }}
          className="w-full accent-[var(--color-info)]"
          aria-label="Radar frame"
        />
        <div className="flex justify-between text-[10px] text-faint">
          <span className="tnum font-mono">{frames[0] ? formatTime(frames[0].time) : "—"}</span>
          <span className="tnum font-mono">
            {frames.at(-1) ? formatTime(frames.at(-1)!.time) : "—"}
          </span>
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 border-t hairline border-line pt-2 sm:grid-cols-3">
          <Toggle
            checked={layers.rain}
            onChange={(checked) => setLayers((value) => ({ ...value, rain: checked }))}
            label="Rain"
          />
          <Toggle
            checked={layers.storms}
            onChange={(checked) => setLayers((value) => ({ ...value, storms: checked }))}
            label="Storms"
            hint="Included in the radar composite"
          />
          <Toggle
            checked={layers.alerts}
            onChange={(checked) => setLayers((value) => ({ ...value, alerts: checked }))}
            label="Severe weather areas"
          />
          <Toggle
            checked={layers.satellite}
            onChange={(checked) => setLayers((value) => ({ ...value, satellite: checked }))}
            label="Satellite (infrared)"
            hint={data.satelliteFrames.length ? undefined : "Not published in this feed"}
          />
          <label className="flex cursor-not-allowed items-start gap-2 py-1 opacity-50">
            <input type="checkbox" disabled className="mt-0.5 size-3.5 shrink-0 appearance-none border border-line bg-ink" />
            <span>
              <span className="block text-[12px] leading-tight">Lightning</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                Requires a commercial lightning feed
              </span>
            </span>
          </label>
          <label className="flex cursor-not-allowed items-start gap-2 py-1 opacity-50">
            <input type="checkbox" disabled className="mt-0.5 size-3.5 shrink-0 appearance-none border border-line bg-ink" />
            <span>
              <span className="block text-[12px] leading-tight">Traffic overlay</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                Needs a traffic tile provider key
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-faint">
        {data.hasNowcast
          ? "Frames after the dashed present marker come from the provider short-range nowcast, not from observations."
          : "All frames are observed radar composites."}{" "}
        Refreshes every {Math.round(data.refreshSeconds / 60)} minutes, the interval the provider publishes.
      </p>
    </DashboardCard>
  );
}
