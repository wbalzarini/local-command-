import type { SourceKind } from "@/types";

export type SourceCategory = "chester-county" | "pennsylvania" | "local";

/** How a source is read. `manual` sources are listed but never fetched. */
export type SourceTransport = "rss" | "html" | "api" | "manual";

export type SourceDefinition = {
  id: string;
  name: string;
  url: string;
  category: SourceCategory;
  transport: SourceTransport;
  kind: SourceKind;
  /** The agency or organisation that publishes it. */
  agency: string;
  /** Whether it is checked unless the user disables it in Settings. */
  enabledByDefault: boolean;
  /**
   * Why this source is here, and any caveat about its reliability. Shown in
   * Settings so the list is auditable rather than a black box.
   */
  note?: string;
};

export type SourceState =
  /** Fetched and parsed. */
  | "ok"
  /** Fetched but nothing could be parsed out of it. */
  | "empty"
  /** Could not be fetched. */
  | "error"
  /** Switched off by the user. */
  | "disabled"
  /** Listed for reference; no automated reader exists for it. */
  | "manual";

export type SourceStatus = {
  id: string;
  name: string;
  url: string;
  agency: string;
  category: SourceCategory;
  transport: SourceTransport;
  state: SourceState;
  lastCheckedAt?: number;
  message?: string;
  /** The registry's note about this source, surfaced as a tooltip. */
  note?: string;
  /** Announcements matched in this source on the last check. */
  matches: number;
};

/**
 * One publicly announced checkpoint, quoted from its announcement.
 *
 * Every field is either taken verbatim from the announcement or explicitly
 * marked as not stated. Nothing here is inferred, and there is deliberately no
 * field for a location more precise than the announcement gave: if an agency
 * announced "Chester County", the app says "Chester County".
 */
export type CheckpointAnnouncement = {
  id: string;
  /** Announcement headline, sanitised. */
  title: string;
  /** The sentence or two that mention the checkpoint, sanitised. */
  excerpt: string;
  /** Date of the enforcement as stated. Null when the announcement gave none. */
  statedDate: string | null;
  /** Time window as stated. Null when not stated. */
  statedTime: string | null;
  /** Area as stated. Never narrowed beyond the announcement's own wording. */
  statedArea: string | null;
  agency: string;
  /** When the announcement itself was published. */
  announcedAt: number | null;
  sourceId: string;
  sourceName: string;
  /** Link to the original announcement. Always present. */
  sourceUrl: string;
};

export type PublicSafetyItem = {
  id: string;
  title: string;
  excerpt: string;
  publishedAt: number | null;
  agency: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  category: "public-safety" | "road-enforcement";
};

export type PublicSafetyData = {
  checkpoints: CheckpointAnnouncement[];
  announcements: PublicSafetyItem[];
  sources: SourceStatus[];
  /** How many sources answered, for the degraded-state message. */
  sourcesChecked: number;
  sourcesFailed: number;
  /** Required wording, kept next to the data it qualifies. */
  disclaimer: string;
};

/**
 * The disclaimer that must accompany any checkpoint display.
 *
 * Kept here rather than in a component so every surface showing this data —
 * the Today card, the Public Safety page, the Alert Center — carries identical
 * wording, and so it cannot be dropped by editing a single view.
 */
export const PUBLIC_SAFETY_DISCLAIMER =
  "Publicly announced information only. The absence of an alert does not mean that no checkpoint or enforcement activity exists.";

/** The empty-state wording. Never "there are no checkpoints". */
export const NO_CHECKPOINTS_FOUND =
  "No publicly announced checkpoints found in monitored sources.";
