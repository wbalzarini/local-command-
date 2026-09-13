/**
 * Sanitising text pulled from external sites.
 *
 * Everything from a police newsroom, a county feed or a news site is untrusted
 * input that ends up rendered in the dashboard, so it is stripped to plain text
 * before it goes anywhere near a component: tags out, entities decoded, scripts
 * and style bodies removed wholesale rather than tag-by-tag, length bounded.
 *
 * React escapes what it renders, so this is defence in depth rather than the
 * only line - but it also stops a feed full of markup from wrecking the layout,
 * which is the more common failure by far.
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&hellip;": "…",
};

const MAX_LENGTH = 600;

/**
 * Codepoint ranges stripped from external text: the C0 and C1 control blocks,
 * the zero-width characters, and the bidirectional overrides - the last of
 * which can make rendered text read differently from the text actually stored.
 *
 * Built numerically rather than written as a literal character class so the
 * ranges stay readable in source and nothing invisible hides in this file.
 */
const INVISIBLE_RANGES: [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
];

const INVISIBLE = new RegExp(
  `[${INVISIBLE_RANGES.map(([start, end]) => `${hexEscape(start)}-${hexEscape(end)}`).join("")}]`,
  "g",
);

function hexEscape(code: number): string {
  return `\\u${code.toString(16).padStart(4, "0")}`;
}

export function sanitizeText(
  input: string | null | undefined,
  maxLength = MAX_LENGTH,
): string {
  if (!input) return "";

  let text = input;

  // Drop entire script and style elements, including their contents; removing
  // only the tags would leave the code behind as visible text.
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<\/(p|div|li|h[1-6])>/gi, " ");
  text = text.replace(/<[^>]*>/g, "");

  text = decodeEntities(text);
  text = text.replace(INVISIBLE, " ");
  text = text.replace(/\s+/g, " ").trim();

  if (text.length > maxLength) {
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return text;
}

function decodeEntities(text: string): string {
  let output = text.replace(/&[a-zA-Z#0-9]+;/g, (entity) => {
    const named = ENTITIES[entity.toLowerCase()];
    if (named) return named;

    const numeric = /^&#(\d+);$/.exec(entity);
    if (numeric) {
      const code = Number(numeric[1]);
      return safeCodePoint(code);
    }

    const hex = /^&#x([0-9a-f]+);$/i.exec(entity);
    if (hex) {
      return safeCodePoint(Number.parseInt(hex[1], 16));
    }

    return " ";
  });

  // One more pass catches doubly-encoded feeds, which are common in the wild.
  if (/&(amp|lt|gt|quot);/i.test(output)) {
    output = output.replace(
      /&(amp|lt|gt|quot);/gi,
      (entity) => ENTITIES[entity.toLowerCase()] ?? " ",
    );
  }

  return output;
}

/** Decoded entities are re-checked, so a numeric escape cannot smuggle one in. */
function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
  const inInvisibleRange = INVISIBLE_RANGES.some(
    ([start, end]) => code >= start && code <= end,
  );
  return inInvisibleRange ? " " : String.fromCodePoint(code);
}

/**
 * Only absolute http(s) links are kept.
 *
 * A "view source" button is worthless if it cannot be trusted, so anything
 * that is not plainly a web address - javascript:, data:, a relative path with
 * no base - is dropped and the UI falls back to the source's own homepage.
 */
export function sanitizeUrl(
  input: string | null | undefined,
  base?: string,
): string | null {
  if (!input) return null;
  const raw = decodeEntities(input).trim();
  if (!raw) return null;

  try {
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
