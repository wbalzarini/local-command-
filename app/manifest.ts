import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * Standalone display and a dark theme so an installed dashboard opens without
 * browser chrome and does not flash white on launch. The icons are the maskable
 * SVG in /public, which is enough for installability; a full icon set can be
 * added without touching anything else here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Command Center",
    short_name: "Command",
    description:
      "Personal intelligence dashboard: weather, commute, alerts and public safety in one daily briefing.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    categories: ["weather", "navigation", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
