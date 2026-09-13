import { PUBLIC_SAFETY_AREA } from "../config";
import type { FeedItem } from "./feed";
import { sanitizeText } from "./sanitize";
import type {
  CheckpointAnnouncement,
  PublicSafetyItem,
  SourceDefinition,
} from "./types";

/**
 * Turning published announcements into checkpoint entries.
 *
 * This module is an aggregator of public announcements and nothing more. The
 * rules it follows are worth stating plainly, because they are the difference
 * between a useful public-information tool and something that pretends to know
 * things it cannot:
 *
 *  - An item becomes a checkpoint entry only if its own text says a checkpoint
 *    was announced. Two independent signals are required: checkpoint wording,
 *    and an announcement or scheduling verb or an explicit date.
 *  - Date, time and area are extracted only where the announcement states
 *    them. Where it does not, the field is null and the UI says "not stated in
 *    announcement". Nothing is guessed, averaged or carried over from a
 *    previous announcement.
 *  - The area is never narrowed. If the announcement says "Chester County",
 *    that is what is stored, even though a more specific guess would look more
 *    impressive on screen.
 *  - No inference about unannounced enforcement, ever. There is no code path
 *    here that predicts a location, extrapolates a pattern from past
 *    announcements, or treats an absence of announcements as information.
 *  - Every entry keeps a link to its original announcement, so any claim on
 *    screen can be checked at its source.
 */

/** Checkpoint wording. Both orderings, because agencies use both. */
const CHECKPOINT_PATTERNS = [
  /\b(sobriety|dui|d\.u\.i\.|impaired[- ]driving|dwi)\b[^.!?]{0,60}\bcheck(?:point|points|-point)\b/i,
  /\bcheck(?:point|points|-point)\b[^.!?]{0,60}\b(sobriety|dui|d\.u\.i\.|impaired|dwi)\b/i,
];

/**
 * An announcement or scheduling signal.
 *
 * Without one of these, checkpoint wording on its own is usually a retrospective
 * ("police arrested four at a checkpoint last month") or general commentary,
 * neither of which is an announcement of enforcement.
 */
const ANNOUNCEMENT_PATTERN =
  /\b(will (?:be )?(?:conduct|hold|operat|stag)\w*|is (?:conducting|holding|planning)|are (?:conducting|holding|planning)|to conduct|to hold|scheduled|announce\w*|plans to|upcoming)\b/i;

/** Dates as agencies write them. */
const DATE_PATTERNS = [
  /\b(?:Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)day,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
];

/** Time windows: "8 p.m. to 2 a.m.", "8PM-2AM", "20:00 until 02:00". */
const TIME_RANGE_PATTERN =
  /\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\s*(?:to|until|through|-|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)/i;

/** Area wording, from most specific published form to least. */
const AREA_PATTERNS = [
  /\bin\s+((?:[A-Z][a-z]+\s+){1,3}(?:Township|Borough|Town|City|County))\b/,
  /\b((?:[A-Z][a-z]+\s+){1,3}(?:Township|Borough))\b/,
  /\b(Chester County)\b/i,
];

/** Broader public-safety wording, for the non-checkpoint announcement list. */
const PUBLIC_SAFETY_PATTERN =
  /\b(public safety|road safety|traffic enforcement|enforcement (?:campaign|detail|initiative)|aggressive driving|seat ?belt|click it or ticket|speed enforcement|road closure|emergency (?:alert|notice))\b/i;

/** Only items that mention the monitored county, or a place inside it. */
const AREA_RELEVANCE = new RegExp(
  `\\b(${PUBLIC_SAFETY_AREA.county}|Chester Co\\.?|West Chester|Coatesville|Kennett Square|Oxford|Downingtown|Phoenixville|Avondale|Malvern|Exton|Parkesburg|${PUBLIC_SAFETY_AREA.stateName} State Police)\\b`,
  "i",
);

export type Extracted = {
  checkpoints: CheckpointAnnouncement[];
  announcements: PublicSafetyItem[];
};

export function extractFromItems(
  items: FeedItem[],
  source: SourceDefinition,
): Extracted {
  const checkpoints: CheckpointAnnouncement[] = [];
  const announcements: PublicSafetyItem[] = [];

  for (const item of items) {
    const text = `${item.title}. ${item.body}`.trim();
    if (!text) continue;

    // Statewide and regional sources carry plenty that has nothing to do with
    // this county; county sources are relevant by definition.
    const relevant =
      source.category === "chester-county" || AREA_RELEVANCE.test(text);
    if (!relevant) continue;

    const checkpoint = toCheckpoint(item, text, source);
    if (checkpoint) {
      checkpoints.push(checkpoint);
      continue;
    }

    if (PUBLIC_SAFETY_PATTERN.test(text)) {
      announcements.push({
        id: `${source.id}-${hash(item.link ?? item.title)}`,
        title: item.title,
        excerpt: excerptFor(text, PUBLIC_SAFETY_PATTERN) ?? sanitizeText(item.body, 300),
        publishedAt: item.publishedAt,
        agency: source.agency,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: item.link ?? source.url,
        category: /road|traffic|enforcement|speed|seat ?belt/i.test(text)
          ? "road-enforcement"
          : "public-safety",
      });
    }
  }

  return { checkpoints, announcements };
}

function toCheckpoint(
  item: FeedItem,
  text: string,
  source: SourceDefinition,
): CheckpointAnnouncement | null {
  const pattern = CHECKPOINT_PATTERNS.find((candidate) => candidate.test(text));
  if (!pattern) return null;

  const statedDate = firstMatch(text, DATE_PATTERNS);

  // The second signal: either an announcement verb, or an explicit date. One
  // of the two must be present for this to be an announcement of enforcement
  // rather than a report about enforcement that already happened.
  if (!ANNOUNCEMENT_PATTERN.test(text) && !statedDate) return null;

  const timeMatch = TIME_RANGE_PATTERN.exec(text);

  return {
    id: `${source.id}-${hash(item.link ?? item.title)}`,
    title: item.title,
    excerpt: excerptFor(text, pattern) ?? sanitizeText(item.body, 400),
    statedDate,
    statedTime: timeMatch ? sanitizeText(timeMatch[0], 60) : null,
    statedArea: statedArea(text),
    agency: source.agency,
    announcedAt: item.publishedAt,
    sourceId: source.id,
    sourceName: source.name,
    // Falls back to the source homepage so "view source" always goes somewhere
    // real, never nowhere.
    sourceUrl: item.link ?? source.url,
  };
}

/**
 * The area exactly as published.
 *
 * Note what is missing: there is no fallback that fills in the county when the
 * announcement did not name one. A null here renders as "not stated in
 * announcement", which is the truthful reading.
 */
function statedArea(text: string): string | null {
  for (const pattern of AREA_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return sanitizeText(match[1], 80);
  }
  return null;
}

/** The sentence containing the match, so the quote keeps its context. */
function excerptFor(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  if (!match || match.index === undefined) return null;

  const start = text.lastIndexOf(".", match.index) + 1;
  const endMarker = text.indexOf(".", match.index + match[0].length);
  const end = endMarker === -1 ? text.length : endMarker + 1;

  const sentence = text.slice(start, end).trim();
  return sentence ? sanitizeText(sentence, 400) : null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return sanitizeText(match[0], 60);
  }
  return null;
}

/** Stable id from a link, so the same announcement is not re-alerted. */
function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}
