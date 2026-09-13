import { cached, lastSuccessAt } from "../cache";
import { PUBLIC_SAFETY_AREA, REFRESH } from "../config";
import { env } from "../env";
import { failureMessage, fetchText } from "../http";
import { extractFromItems } from "./extract";
import { parseFeed, parseHtmlLinks } from "./feed";
import { sourcesFor, SOURCES } from "./registry";
import {
  NO_CHECKPOINTS_FOUND,
  PUBLIC_SAFETY_DISCLAIMER,
  type CheckpointAnnouncement,
  type PublicSafetyData,
  type PublicSafetyItem,
  type SourceDefinition,
  type SourceStatus,
} from "./types";
import type { Alert, ModuleSnapshot, SourceRef } from "@/types";

/**
 * The public safety service.
 *
 * Reads every enabled source, extracts what was actually announced, and reports
 * per-source status alongside the results. The status list is not decoration:
 * when four of five sources fail, "nothing found" means something very
 * different from when all five answered, and the module says which.
 *
 * Announcements older than the retention window are dropped, because a
 * checkpoint announced six weeks ago is not information about tonight.
 */

/** How far back an announcement is still shown. */
const RETENTION_DAYS = 45;

const SERVICE_SOURCE: SourceRef = {
  name: `${PUBLIC_SAFETY_AREA.county} public announcement sources`,
  kind: "official",
};

export async function getPublicSafety(
  disabledSourceIds: string[] = [],
): Promise<ModuleSnapshot<PublicSafetyData>> {
  const key = `public-safety:${[...disabledSourceIds].sort().join(",")}`;

  if (env.demoMode()) {
    // Checkpoint announcements are never simulated. A plausible-looking fake
    // here would be indistinguishable from a real announcement on screen, and
    // this is precisely the data where that must not happen.
    return {
      id: "public-safety",
      label: "Public Safety",
      data: {
        checkpoints: [],
        announcements: [],
        sources: SOURCES.map((source) => statusFor(source, "manual", "Not checked in sample mode")),
        sourcesChecked: 0,
        sourcesFailed: 0,
        disclaimer: PUBLIC_SAFETY_DISCLAIMER,
      },
      status: {
        state: "demo",
        message: "Sample mode — public announcements are never simulated, so no sources were checked.",
      },
      timestamp: Date.now(),
      sources: [SERVICE_SOURCE],
      alerts: [],
      summary: "Public safety sources are not checked in sample mode.",
    };
  }

  const result = await cached<PublicSafetyData>(key, REFRESH.publicSafety, () =>
    collect(disabledSourceIds),
  );

  if (!result) {
    return {
      id: "public-safety",
      label: "Public Safety",
      data: null,
      status: {
        state: "unavailable",
        message: "Public safety sources could not be checked.",
        lastSuccessAt: lastSuccessAt(key),
      },
      timestamp: Date.now(),
      sources: [SERVICE_SOURCE],
      alerts: [],
      // Not "no checkpoints" — we could not check.
      summary: "Public safety sources could not be checked, so no announcement information is available.",
    };
  }

  const data = result.value;
  const allFailed = data.sourcesChecked > 0 && data.sourcesFailed === data.sourcesChecked;

  return {
    id: "public-safety",
    label: "Public Safety",
    data,
    status: allFailed
      ? {
          state: "unavailable",
          message: "No monitored source could be reached on this check.",
          lastSuccessAt: result.storedAt,
        }
      : data.sourcesFailed > 0
        ? {
            state: "degraded",
            message: `${data.sourcesFailed} of ${data.sourcesChecked} monitored sources could not be reached.`,
            lastSuccessAt: result.storedAt,
          }
        : result.stale
          ? {
              state: "stale",
              message: "Sources could not be re-checked — showing the last successful check.",
              lastSuccessAt: result.storedAt,
            }
          : { state: "ok", lastSuccessAt: result.storedAt },
    timestamp: result.storedAt,
    sources: [
      SERVICE_SOURCE,
      ...data.sources
        .filter((source) => source.state === "ok")
        .map((source) => ({
          name: source.name,
          kind: "official" as const,
          url: source.url,
          fetchedAt: source.lastCheckedAt,
        })),
    ],
    alerts: checkpointAlerts(data),
    summary: summarise(data),
  };
}

async function collect(disabledSourceIds: string[]): Promise<PublicSafetyData> {
  const { active, inactive } = sourcesFor(disabledSourceIds);

  const checkpoints: CheckpointAnnouncement[] = [];
  const announcements: PublicSafetyItem[] = [];
  const statuses: SourceStatus[] = [];
  let failed = 0;

  const results = await Promise.all(active.map((source) => read(source)));

  for (const { source, status, extracted } of results) {
    statuses.push(status);
    if (status.state === "error") failed += 1;
    if (!extracted) continue;
    checkpoints.push(...extracted.checkpoints);
    announcements.push(...extracted.announcements);
    void source;
  }

  for (const source of inactive) {
    statuses.push(
      statusFor(
        source,
        source.transport === "manual" ? "manual" : "disabled",
        source.transport === "manual"
          ? "No machine-readable feed; check manually."
          : "Disabled in settings.",
      ),
    );
  }

  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
  const recent = <T extends { announcedAt?: number | null; publishedAt?: number | null }>(
    item: T,
  ) => {
    const when = item.announcedAt ?? item.publishedAt ?? null;
    // Undated items are kept: an agency page with no timestamp is still an
    // announcement, and dropping it would lose real information.
    return when === null || when >= cutoff;
  };

  return {
    checkpoints: dedupe(checkpoints.filter(recent)).sort(byRecency),
    announcements: dedupe(announcements.filter(recent)).sort(byRecency).slice(0, 20),
    sources: statuses,
    sourcesChecked: active.length,
    sourcesFailed: failed,
    disclaimer: PUBLIC_SAFETY_DISCLAIMER,
  };
}

async function read(source: SourceDefinition) {
  const response = await fetchText(source.url, {
    timeoutMs: 10_000,
    revalidate: 0,
    headers: { "User-Agent": env.nwsUserAgent() },
  });

  if (!response.ok) {
    return {
      source,
      status: statusFor(source, "error", failureMessage(response)),
      extracted: null,
    };
  }

  const items =
    source.transport === "rss"
      ? parseFeed(response.value, source.url)
      : parseHtmlLinks(response.value, source.url);

  if (!items.length) {
    return {
      source,
      status: statusFor(source, "empty", "Source was reachable but nothing could be parsed from it."),
      extracted: null,
    };
  }

  const extracted = extractFromItems(items, source);

  return {
    source,
    status: {
      ...statusFor(source, "ok"),
      matches: extracted.checkpoints.length + extracted.announcements.length,
    },
    extracted,
  };
}

function statusFor(
  source: SourceDefinition,
  state: SourceStatus["state"],
  message?: string,
): SourceStatus {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    agency: source.agency,
    category: source.category,
    transport: source.transport,
    state,
    lastCheckedAt: state === "manual" || state === "disabled" ? undefined : Date.now(),
    message,
    note: source.note,
    matches: 0,
  };
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

function byRecency(
  a: { announcedAt?: number | null; publishedAt?: number | null },
  b: { announcedAt?: number | null; publishedAt?: number | null },
): number {
  return (b.announcedAt ?? b.publishedAt ?? 0) - (a.announcedAt ?? a.publishedAt ?? 0);
}

function checkpointAlerts(data: PublicSafetyData): Alert[] {
  return data.checkpoints.map((checkpoint) => ({
    id: `public-safety-${checkpoint.id}`,
    module: "public-safety",
    category: "public-safety" as const,
    severity: "advisory" as const,
    priority: 5 as const,
    title: `Publicly announced sobriety checkpoint — ${checkpoint.statedArea ?? PUBLIC_SAFETY_AREA.county}`,
    body: checkpoint.excerpt,
    area: checkpoint.statedArea ?? undefined,
    issuedAt: checkpoint.announcedAt ?? undefined,
    source: {
      name: checkpoint.sourceName,
      kind: "official",
      url: checkpoint.sourceUrl,
    },
  }));
}

/**
 * The summary line, which must distinguish three different situations: nothing
 * announced, nothing found because sources failed, and something announced.
 */
function summarise(data: PublicSafetyData): string {
  if (data.checkpoints.length) {
    const areas = [
      ...new Set(data.checkpoints.map((checkpoint) => checkpoint.statedArea ?? PUBLIC_SAFETY_AREA.county)),
    ];
    return `${data.checkpoints.length} publicly announced ${
      data.checkpoints.length === 1 ? "checkpoint" : "checkpoints"
    } found in monitored sources (${areas.join(", ")}).`;
  }

  if (data.sourcesFailed === data.sourcesChecked && data.sourcesChecked > 0) {
    return "No monitored source could be reached, so no announcement information is available.";
  }

  if (data.sourcesFailed > 0) {
    return `${NO_CHECKPOINTS_FOUND} ${data.sourcesFailed} of ${data.sourcesChecked} sources could not be reached.`;
  }

  return NO_CHECKPOINTS_FOUND;
}
