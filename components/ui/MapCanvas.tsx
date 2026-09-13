"use client";

import { useEffect, useRef, useState } from "react";
import type * as LeafletNamespace from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * The shared map surface, used by both the radar and the traffic map.
 *
 * Leaflet is loaded with a dynamic import inside an effect, which does three
 * things worth having: it keeps the library and its CSS out of the initial
 * bundle so the Today page paints without them, it guarantees the code only
 * ever runs in the browser (Leaflet touches `window` at module scope), and it
 * lets the map render a placeholder while it arrives.
 *
 * Callers get the Leaflet namespace and the map instance in `onReady` and add
 * their own layers. Everything they add is torn down when the component
 * unmounts — React's development double-mount will otherwise leave a second
 * map attached to the same container and Leaflet throws on the retry.
 */

export type MapReady = {
  L: typeof LeafletNamespace;
  map: LeafletNamespace.Map;
};

/**
 * A dark basemap, so radar echoes and route lines read against it. CARTO's
 * tiles are OpenStreetMap data; both are credited, as their terms require.
 */
const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function MapCanvas({
  center,
  zoom,
  height = 320,
  onReady,
  className = "",
  ariaLabel,
}: {
  center: [number, number];
  zoom: number;
  height?: number;
  onReady: (ready: MapReady) => void | (() => void);
  className?: string;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // Held in a ref so changing the callback identity does not tear the map down
  // and rebuild it on every parent render.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let map: LeafletNamespace.Map | null = null;
    let disposeLayers: (() => void) | void;
    let cancelled = false;

    void (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;

        map = L.map(containerRef.current, {
          center,
          zoom,
          zoomControl: true,
          attributionControl: true,
          // A dashboard map should not swallow the page scroll on mobile.
          scrollWheelZoom: false,
        });

        L.tileLayer(BASEMAP_URL, {
          attribution: BASEMAP_ATTRIBUTION,
          maxZoom: 18,
          subdomains: "abcd",
        }).addTo(map);

        disposeLayers = onReadyRef.current({ L, map });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      if (typeof disposeLayers === "function") disposeLayers();
      map?.remove();
    };
    // Re-creating the map when the centre moves is intentional and rare; the
    // layer callbacks handle everything that changes frequently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div
        ref={containerRef}
        className="size-full bg-ink"
        style={{ height }}
        role="application"
        aria-label={ariaLabel}
      />

      {state !== "ready" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/80">
          <p className={`text-[12px] ${state === "error" ? "text-level-severe" : "animate-sweep text-faint"}`}>
            {state === "error" ? "Map could not be loaded." : "Loading map…"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
