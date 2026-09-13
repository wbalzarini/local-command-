import { failureMessage, fetchJson } from "../http";
import type { SourceRef } from "@/types";
import type { RadarData, RadarFrame } from "./types";

/**
 * Radar frames from RainViewer's public tile index. No key required.
 *
 * The index lists the frames the provider currently has cached, past and
 * nowcast, each as a path to a tile pyramid. The client needs the whole list
 * rather than one image so it can animate through them locally without asking
 * the server for a frame at a time.
 */

const MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";

/** RainViewer publishes a new radar composite roughly every ten minutes. */
const PROVIDER_REFRESH_SECONDS = 600;

export const RADAR_SOURCE: SourceRef = {
  name: "RainViewer",
  kind: "provider",
  url: "https://www.rainviewer.com/api.html",
};

export const BASEMAP_SOURCE: SourceRef = {
  name: "OpenStreetMap contributors",
  kind: "provider",
  url: "https://www.openstreetmap.org/copyright",
};

type RainViewerFrame = { time?: number; path?: string };

type RainViewerResponse = {
  version?: string;
  generated?: number;
  host?: string;
  radar?: { past?: RainViewerFrame[]; nowcast?: RainViewerFrame[] };
  satellite?: { infrared?: RainViewerFrame[] };
};

export type RadarFetch =
  | { ok: true; data: RadarData }
  | { ok: false; message: string };

export async function fetchRadar(): Promise<RadarFetch> {
  const response = await fetchJson<RainViewerResponse>(MAPS_URL, {
    timeoutMs: 8_000,
    revalidate: 0,
  });

  if (!response.ok) return { ok: false, message: failureMessage(response) };

  const body = response.value;
  const host = body.host ?? "https://tilecache.rainviewer.com";

  const past = (body.radar?.past ?? []).map((frame) => toFrame(frame, host, true));
  const nowcast = (body.radar?.nowcast ?? []).map((frame) => toFrame(frame, host, false));
  const satellite = (body.satellite?.infrared ?? []).map((frame) =>
    toSatelliteFrame(frame, host),
  );

  const frames = [...past, ...nowcast].filter(
    (frame): frame is RadarFrame => frame !== null,
  );

  if (!frames.length) {
    return { ok: false, message: "Provider returned no radar frames" };
  }

  return {
    ok: true,
    data: {
      frames,
      host,
      generatedAt: (body.generated ?? Math.floor(Date.now() / 1000)) * 1000,
      refreshSeconds: PROVIDER_REFRESH_SECONDS,
      hasNowcast: nowcast.some((frame) => frame !== null),
      satelliteFrames: satellite.filter((frame): frame is RadarFrame => frame !== null),
    },
  };
}

/**
 * Builds the tile template for one frame.
 *
 * The trailing segments are RainViewer's tile options: 256px tiles, colour
 * scheme 4 (the "universal blue" ramp, which reads cleanly on a dark
 * basemap), smoothing on and snow detection on.
 */
function toFrame(
  frame: RainViewerFrame,
  host: string,
  past: boolean,
): RadarFrame | null {
  if (!frame.time || !frame.path) return null;
  return {
    time: frame.time * 1000,
    urlTemplate: `${host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`,
    past,
  };
}

function toSatelliteFrame(frame: RainViewerFrame, host: string): RadarFrame | null {
  if (!frame.time || !frame.path) return null;
  // Colour scheme 0 with no smoothing is the infrared cloud-top product.
  return {
    time: frame.time * 1000,
    urlTemplate: `${host}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`,
    past: true,
  };
}
