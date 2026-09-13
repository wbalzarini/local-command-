import { sanitizeText, sanitizeUrl } from "./sanitize";

/**
 * A minimal RSS/Atom reader.
 *
 * Deliberately regex-based rather than a parser dependency: the app needs four
 * fields from each item, the feeds involved are ordinary RSS 2.0 and Atom, and
 * a malformed feed should yield fewer items rather than throw. Everything that
 * comes out has already been through the sanitiser.
 */

export type FeedItem = {
  title: string;
  /** Description or summary, plain text. */
  body: string;
  link: string | null;
  publishedAt: number | null;
};

export function parseFeed(xml: string, baseUrl: string): FeedItem[] {
  const blocks = [
    ...matchAll(xml, /<item\b[^>]*>([\s\S]*?)<\/item>/gi),
    ...matchAll(xml, /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi),
  ];

  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = sanitizeText(tag(block, "title"), 300);
    if (!title) continue;

    items.push({
      title,
      body: sanitizeText(
        tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content:encoded") ?? tag(block, "content"),
        1200,
      ),
      link: sanitizeUrl(tag(block, "link") ?? atomLink(block), baseUrl),
      publishedAt: toTimestamp(
        tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"),
      ),
    });
  }

  return items;
}

/**
 * Best-effort extraction of headline links from a plain HTML page.
 *
 * Used for agency newsrooms that publish no feed. It only ever returns link
 * text and the link itself — never a synthesised summary — because anything
 * more would be this module guessing at the content of an announcement it
 * cannot actually read.
 */
export function parseHtmlLinks(html: string, baseUrl: string): FeedItem[] {
  // Strip the furniture first, so navigation menus do not read as headlines.
  const body = html
    .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const items: FeedItem[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = sanitizeText(match[2], 300);
    // Short link text is a button or a breadcrumb, not a headline.
    if (text.length < 25) continue;

    const link = sanitizeUrl(match[1], baseUrl);
    if (!link || seen.has(link)) continue;
    seen.add(link);

    items.push({ title: text, body: "", link, publishedAt: null });
    if (items.length >= 80) break;
  }

  return items;
}

function matchAll(input: string, pattern: RegExp): string[] {
  return [...input.matchAll(pattern)].map((match) => match[1]);
}

function tag(block: string, name: string): string | null {
  const pattern = new RegExp(`<${escapeName(name)}\\b[^>]*>([\\s\\S]*?)</${escapeName(name)}>`, "i");
  const match = pattern.exec(block);
  return match ? match[1] : null;
}

/** Atom puts the URL in an attribute rather than the element body. */
function atomLink(block: string): string | null {
  const match = /<link\b[^>]*href=["']([^"']+)["']/i.exec(block);
  return match ? match[1] : null;
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(sanitizeText(value, 80)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}
