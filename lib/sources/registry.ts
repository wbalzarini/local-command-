import type { SourceDefinition } from "./types";

/**
 * The public-safety source registry.
 *
 * Adding a source is adding an entry here. Nothing else in the app hard-codes
 * a URL, and Settings renders this list with each source's live status, so what
 * is being monitored is always inspectable rather than implied.
 *
 * Two rules shape the list. Every source is an official public-information
 * channel or a news organisation reporting on one — there is nothing here that
 * is not published for the public to read. And sources with no machine-readable
 * feed are listed as `manual` rather than scraped speculatively: a parser that
 * half-works on a page that was never meant to be parsed produces exactly the
 * kind of confident wrong answer this module must not produce.
 */

export const SOURCES: SourceDefinition[] = [
  // ---- Chester County -----------------------------------------------------
  {
    id: "chesco-news",
    name: "Chester County news releases",
    url: "https://www.chesco.org/RSSFeed.aspx?ModID=76&CID=All-newsflash.xml",
    category: "chester-county",
    transport: "rss",
    kind: "official",
    agency: "Chester County Government",
    enabledByDefault: true,
    note: "County newsflash feed. Chester County runs CivicPlus; if they renumber their modules this feed id needs updating, which shows up here as an empty or failed source rather than as silence.",
  },
  {
    id: "chesco-emergency-services",
    name: "Chester County Emergency Services",
    url: "https://www.chesco.org/175/Emergency-Services",
    category: "chester-county",
    transport: "html",
    kind: "official",
    agency: "Chester County Department of Emergency Services",
    enabledByDefault: true,
    note: "Public safety announcements page. Read as HTML, best-effort.",
  },
  {
    id: "chesco-da",
    name: "Chester County District Attorney",
    url: "https://www.chesco.org/1600/District-Attorney",
    category: "chester-county",
    transport: "html",
    kind: "official",
    agency: "Chester County District Attorney's Office",
    enabledByDefault: true,
    note: "The DA's office announces county-wide DUI enforcement initiatives.",
  },

  // ---- Pennsylvania statewide ---------------------------------------------
  {
    id: "psp-newsroom",
    name: "Pennsylvania State Police newsroom",
    url: "https://www.pa.gov/agencies/psp/newsroom.html",
    category: "pennsylvania",
    transport: "html",
    kind: "official",
    agency: "Pennsylvania State Police",
    enabledByDefault: true,
    note: "PSP press releases. Pennsylvania consolidated agency sites onto pa.gov, so this page's markup changes periodically; failures surface as an error state on this source.",
  },
  {
    id: "penndot-news",
    name: "PennDOT news",
    url: "https://www.penndot.pa.gov/pages/all-news.aspx",
    category: "pennsylvania",
    transport: "html",
    kind: "government",
    agency: "Pennsylvania Department of Transportation",
    enabledByDefault: true,
    note: "Road safety and enforcement-campaign announcements.",
  },
  {
    id: "pa-dui-association",
    name: "Pennsylvania DUI Association",
    url: "https://www.padui.org/",
    category: "pennsylvania",
    transport: "manual",
    kind: "official",
    agency: "Pennsylvania DUI Association",
    enabledByDefault: false,
    note: "Coordinates statewide enforcement programmes but publishes no machine-readable announcement feed. Listed for reference; check manually.",
  },

  // ---- Local --------------------------------------------------------------
  {
    id: "daily-local-news",
    name: "Daily Local News (West Chester)",
    url: "https://www.dailylocal.com/feed/",
    category: "local",
    transport: "rss",
    kind: "news",
    agency: "Daily Local News",
    enabledByDefault: true,
    note: "Chester County's daily paper. Reports on police announcements; treated as a news report of an announcement, not as the announcement itself.",
  },
  {
    id: "wchs-6abc",
    name: "6abc Philadelphia",
    url: "https://6abc.com/feed/",
    category: "local",
    transport: "rss",
    kind: "news",
    agency: "6abc Action News",
    enabledByDefault: true,
    note: "Regional coverage including Chester County.",
  },
  {
    id: "municipal-police",
    name: "Municipal police departments",
    url: "https://www.chesco.org/206/Police-Departments",
    category: "local",
    transport: "manual",
    kind: "official",
    agency: "Chester County municipal police",
    enabledByDefault: false,
    note: "Individual departments announce checkpoints on their own sites and official social accounts, which have no common feed format. Listed so the gap is visible; add a per-department entry above when a department publishes a readable feed.",
  },
];

export function sourcesFor(
  disabledIds: string[] = [],
): { active: SourceDefinition[]; inactive: SourceDefinition[] } {
  const active: SourceDefinition[] = [];
  const inactive: SourceDefinition[] = [];

  for (const source of SOURCES) {
    const enabled = source.enabledByDefault && !disabledIds.includes(source.id);
    if (enabled && source.transport !== "manual") active.push(source);
    else inactive.push(source);
  }

  return { active, inactive };
}

export function sourceById(id: string): SourceDefinition | undefined {
  return SOURCES.find((source) => source.id === id);
}
