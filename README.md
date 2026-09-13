# Command Center

A personal intelligence dashboard for one place and one commute. It answers a
single question the moment it opens: **what do I need to know about today?**

Weather now and for the next ten days, barometric pressure as a first-class
reading, live radar, official severe-weather alerts, a traffic-aware commute
with alternates and a departure time, road conditions, publicly announced
public-safety information, and a daily briefing assembled from all of it —
plus a "what changed" list so a second look costs a glance rather than a
re-read.

Location: **Avondale, Pennsylvania 19311**. Commute: Avondale → JPMorgan Chase,
500 Stein Christiana Road, Newark, Delaware.

---

## Two principles

Everything below follows from these, and most of the design decisions in the
code make sense only in their light.

**1. The dashboard never claims to know something it does not.**

Every module reports a state alongside its data, and "we could not ask" is a
different state from "we asked and there is nothing". A failed provider shows
as unavailable with the time of the last successful reading, never as an empty
card and never as good news. The daily briefing names what it could not
retrieve instead of silently omitting that paragraph, because a briefing with
the traffic sentence missing reads as *traffic is fine*. The public-safety
module never says there are no checkpoints — it says whether anything was found
in the sources it monitors, and how many of those sources answered.

**2. Simulated data is always labelled, and some things are never simulated.**

`DEMO_MODE=1` generates sample weather, air quality and routing so the interface
can be built with no network, and every one of those carries a `DEMO DATA`
badge. Severe-weather alerts, radar imagery and public-safety announcements are
*not* simulated even in demo mode: a plausible-looking fake tornado warning or
checkpoint announcement is indistinguishable from a real one on screen, and
that is exactly the data where that must not happen.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

No API keys needed. Out of the box you get real forecast data, real radar and
real National Weather Service alerts for Avondale, and free-flow-only commute
times that are labelled as such.

To work on the interface with no network at all:

```bash
DEMO_MODE=1 npm run dev
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build. Must pass before any PR. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm start` | Serve a production build |

---

## Data sources

### Weather — Open-Meteo, no key

`lib/weather/openMeteo.ts`. Chosen because it needs no account, so a fresh
clone shows real weather rather than sample data, and because it publishes
everything the dashboard needs from a single request: current conditions,
eleven days of hourly data including mean-sea-level pressure, and daily
aggregates. The whole Today page costs one upstream call.

Normalised at the edge to °F, mph, inHg, miles and inches, so no component ever
has to know which provider a number came from. Units in the UI are a display
setting applied on top.

### Severe weather alerts — National Weather Service, no key

`lib/weather/nws.ts`, `api.weather.gov/alerts/active?point=…`.

Alerts come from NWS and only from NWS, even though the forecast provider also
publishes a warnings feed. A tornado warning is a legal product issued by a
government office; the app quotes the office, shows it as the source, and links
the full text — a warning's instructions matter more than any summary of them.

NWS asks API consumers to identify themselves in `User-Agent`. Set
`NWS_USER_AGENT` to something that reaches you.

### Radar — RainViewer, no key

`lib/weather/radar.ts`. The app fetches the frame index; the browser fetches
tiles from the provider directly, which is the only way an animated loop stays
responsive. Past frames and the provider's short-range nowcast are both shown,
visually distinguished, with the present marked. Refreshes on the provider's
own published ten-minute interval.

### Air quality — Open-Meteo Air Quality (CAMS), no key

`lib/weather/airQuality.ts`. US EPA AQI, PM2.5, PM10, ozone and aerosol optical
depth as a smoke proxy. Pollen is published for European locations only, so for
Avondale it is reported as "not published for this location" rather than
omitted — an omitted row reads as zero.

### Historical weather — Open-Meteo forecast + ERA5 archive, no key

`lib/weather/history.ts`. Recent history comes from the forecast endpoint's
`past_days`, which stays current to the hour. A full year comes from the ERA5
reanalysis archive, which is the better record but lags real time by about five
days, so it is used only where that lag does not matter.

"Today vs normal" averages this calendar date over the last ten years of
reanalysis, and the UI says so — it is not an official NOAA climatological
normal and is labelled to prevent it being read as one.

### Traffic and routing — one of four providers

`lib/routing/providers/`. Preference order, which is also the failover order:

| Provider | Key | Traffic | Geometry |
| --- | --- | --- | --- |
| Mapbox Directions | `MAPBOX_TOKEN` | Yes — `duration` vs `duration_typical` | Yes |
| HERE Routing v8 | `HERE_API_KEY` | Yes — `duration` vs `baseDuration` | No (see below) |
| Google Routes v2 | `GOOGLE_MAPS_API_KEY` | Yes — `duration` vs `staticDuration` | Yes |
| OSRM public server | none | **No** | Yes |

Each traffic-aware provider returns both a live and a no-traffic duration for
the same route, so the delay is a measured difference rather than a guess at
what "normal" means.

**Without any key**, the commute module still works and is genuinely useful —
real road geometry, real distances, real free-flow times, real alternates — but
it has no traffic model at all. So `delayMinutes` is `null` rather than zero,
the status badge reads `NO TRAFFIC DATA`, and the UI states that the times are
free-flow estimates. A zero delay would read as "no traffic today", which is a
claim OSRM cannot support. The OSRM demo server is also rate-limited by its
operators and is not suitable for a deployment you rely on.

HERE returns geometry as its own flexible-polyline encoding. Rather than ship a
decoder for a format this app would use nowhere else, HERE routes carry no
geometry and the map says so; timings, comparison and departure all work.

### Road conditions — PennDOT 511PA

`lib/traffic/roads.ts`, needs `PENNDOT_API_KEY`. Authoritative for Pennsylvania
state roads, which is most of this commute's first half.

511PA's endpoint and field names have changed across versions of their API, so
both the URL (`PENNDOT_EVENTS_URL`) and the key are configuration, and the
parser reads defensively and accepts several spellings of each field. **If the
contract has moved since this was written, the module reports itself
unconfigured or failed — it does not report that the roads are clear.**

### Public safety — a configurable source registry

`lib/sources/registry.ts` lists every source, grouped by Chester County,
Pennsylvania statewide, and local. Each entry carries a name, URL, transport,
agency, default enabled state and a note about its reliability. Settings renders
this list with each source's live status, so what is being monitored is always
inspectable.

Sources with no machine-readable feed are listed as `manual` rather than scraped
speculatively — a parser that half-works on a page never meant to be parsed
produces exactly the kind of confident wrong answer this module must not
produce. That gap is shown in the UI rather than hidden.

---

## The public-safety module, specifically

`lib/sources/extract.ts` turns published announcements into checkpoint entries,
and the rules it follows are the difference between a public-information tool
and something that pretends to know things it cannot:

- An item becomes a checkpoint entry only if its own text says a checkpoint was
  announced. Two independent signals are required: checkpoint wording, plus
  either an announcement verb or an explicit date. Without that, checkpoint
  wording is usually a report about enforcement that already happened.
- Date, time and area are extracted only where the announcement states them.
  Where it does not, the field renders as "not stated in announcement".
- The area is never narrowed. If an agency announced "Chester County", that is
  what is shown, even though a more specific guess would look more impressive.
- **No inference about unannounced enforcement, ever.** There is no code path
  that predicts a location, extrapolates from past announcements, or treats an
  absence of announcements as information.
- Every entry links its original announcement, so any claim on screen can be
  checked at its source.
- The empty state is "No publicly announced checkpoints found in monitored
  sources", never "there are no checkpoints", and it always appears with:
  *Publicly announced information only. The absence of an alert does not mean
  that no checkpoint or enforcement activity exists.*
- When every source fails, the headline changes to say that no source could be
  reached, rather than reporting "nothing found" with a caveat attached.

All external text is stripped to plain text before rendering
(`lib/sources/sanitize.ts`): tags out, entities decoded, script and style bodies
removed wholesale, control characters and bidirectional overrides stripped,
length bounded, and only absolute `http(s)` links kept.

The module contains no guidance on avoiding law enforcement and aggregates only
information agencies and news organisations have chosen to publish.

---

## Architecture

### The module contract

Every module exposes the same shape (`types/index.ts`):

```ts
type ModuleSnapshot<T> = {
  id: string;
  label: string;
  data: T | null;
  status: { state: DataState; message?: string; lastSuccessAt?: number };
  timestamp: number;
  sources: SourceRef[];
  alerts: Alert[];
  summary: string;      // one sentence, built only from values present in data
};
```

`DataState` is `ok | stale | degraded | unavailable | demo | locked`. The Today
page does not know how any module fetches anything — it knows this shape, which
is what makes adding a module a matter of registering one more snapshot rather
than reworking the dashboard.

### Layout

```
  app/              /, /weather/*, /commute, /alerts, /public-safety,
                    /outdoor, /settings
    api/            weather, alerts, air-quality, radar, commute, roads,
                    public-safety, history, command-center, auth
  components/
    command-center/   header, nav, shell, day status, next 6 hours, what changed
    weather/          current, pressure, trends, hourly, 10-day, air, daylight
    commute/          commute, departure, routes, impact, map, passcode gate
    traffic/          road conditions
    radar/            animated radar map
    alerts/           alert center
    public-safety/    checkpoint panel, source status
    briefing/         daily briefing
    settings/         settings screen
    ui/               primitives, hand-rolled SVG charts, Leaflet canvas
  lib/
    weather/          providers, pressure analysis, trend engine, service
    routing/          provider chain, geocoding, departure planning, service
    traffic/          PennDOT road conditions
    sources/          registry, feed parsing, extraction, sanitising, service
    alerts/           ranking engine, forecast-derived alerts
    intelligence/     day status, briefing, what changed, the aggregate
    modules/          module registry: navigation and section ordering
    settings/         browser-stored settings, request parameters
    notifications/    notification rules and delivery
  types/              the shared vocabulary
```

### Where the intelligence lives

The modules are independent — weather has no idea a commute exists. All
cross-module reasoning is in `lib/intelligence/commandCenter.ts`:

- the commute is scored against the forecast **for the hour of the drive**, not
  the weather outside now, which is a different thing at 6am;
- the day status weighs traffic against alerts against air quality;
- the briefing reads each module's own summary, so modules own their wording and
  the briefing cannot overstate what a module knows;
- "what changed" diffs the whole picture against the last assembly.

### Day status scoring

A deliberately simple, fully transparent points model
(`lib/intelligence/dayStatus.ts`). Five categories — Weather, Severe Weather,
Commute, Road Conditions, Public Safety — each contribute points for specific
named conditions; the sum picks a band. Every category reports the points it
contributed and the UI shows them, so the score can always be taken apart into
"why".

A category that could not be checked scores zero and reports `UNKNOWN`, so a
failed feed never masquerades as a quiet one. It is a convenience indicator, not
an authoritative index, and the card says so.

### Pressure

`lib/weather/pressure.ts`. Trend classification reads the three-hour tendency,
the standard meteorological practice, with six, twelve and twenty-four hour
windows reported alongside — a slow twelve-hour slide and a sharp three-hour
drop mean different things and one arrow would flatten them into the same
reading. Interpretations talk about atmospheric stability and stop there:
pressure alone does not predict a particular storm, and the copy never implies
it does.

### Trends

`lib/weather/trends.ts` measures each metric's **most extreme value in the
window against now**, not the value at the window's end. Temperature, humidity
and cloud cover all cycle daily, so "24 hours from now minus now" lands back
near zero for every one of them and would report a flat day whatever the weather
does in between.

### Charts and maps

Charts are hand-rolled SVG (`components/ui/charts.tsx`): a line, a filled line,
bars, high/low ranges and a sparkline, each a dozen lines of path maths. A
charting library would be larger than the rest of the client bundle and would
still need fighting to look like a terminal rather than a slide deck. Gaps in
provider data are drawn as gaps rather than interpolated across.

Maps use Leaflet, dynamically imported inside an effect
(`components/ui/MapCanvas.tsx`), which keeps it out of the initial bundle,
guarantees it only runs in the browser, and lets the map show a placeholder
while it loads.

### Caching and refresh

`lib/cache.ts` does three jobs: bounds provider calls to at most one per refresh
interval per key, collapses concurrent callers onto a single upstream request,
and keeps the last good value so an outage degrades to `stale` with a timestamp
rather than to an empty card.

| Module | Interval |
| --- | --- |
| Weather | 10 min |
| Severe weather alerts | 5 min |
| Radar index | 5 min (tiles on the provider's 10-min cadence) |
| Air quality | 30 min |
| Traffic | 5 min, tightened to 1 min inside a commute window |
| Road conditions | 10 min |
| Public safety | 30 min |
| History | 60 min |

The browser polls every 3 minutes, tightening to 1 minute inside a commute
window, and not at all in a hidden tab — it refreshes once on becoming visible
instead. Because provider rates are bounded server-side, a fast poll cannot run
up a bill or trip a rate limit.

API responses are `no-store`. A CDN cache on top of `lib/cache.ts` would make
the "last updated" stamp on screen lie about when the data was actually read.

The cache is process-local, so on serverless it lives as long as the warm
instance. That is enough for its job; the same applies to the previous snapshot
used by "what changed", which is why the browser also keeps its own copy in
`localStorage` and sends it with each refresh — "what changed" should mean
"since *you* last looked".

### Rate limits

- **Open-Meteo** asks for roughly 15 minutes between calls for the same point
  on the free tier. The 10-minute weather interval plus request coalescing keeps
  the whole app to a handful of calls an hour regardless of how many tabs are
  open.
- **api.weather.gov** has no published hard limit but expects a real
  `User-Agent` and reasonable behaviour.
- **RainViewer**'s public index is free; tiles are fetched by the browser.
- **Nominatim** asks callers not to repeat identical queries; geocoding results
  are cached for a day and only the work address is ever geocoded.
- **OSRM's demo server** is best-effort and rate-limited by its operators.
- **Mapbox, HERE, Google** all bill per request. The traffic interval and the
  in-flight coalescing are what keep a dashboard left open all day from
  becoming an invoice.

---

## Privacy

The app knows where its owner lives. That shapes several decisions:

- **All provider calls are server-side.** The browser only ever talks to this
  app's own `/api` routes, so no key and no address reaches a client bundle.
- **Home coordinates default to the borough centroid**, not a street address.
  The weather is identical either way and the town reveals less.
- **The home address is never geocoded.** Only the work address is sent to a
  geocoder — the one request that would hand a third party the thing this app is
  most careful with.
- **`HOME_ADDRESS` is read on the server to build routes and is never included
  in an API response**, nor in the Settings page, which shows labels only.
- **The passcode gate.** With `COMMAND_CENTER_PASSCODE` set, the commute and
  road modules return `locked` — as data, so a locked deployment renders a lock
  card rather than leaking the route through a component that forgot to check.
  The cookie holds a SHA-256 digest rather than the passcode, is `httpOnly`, and
  is compared in constant time. Set this before exposing the app publicly.
- **All external content is sanitised** before rendering.
- **No accounts, no database, no analytics.** Settings and the dashboard
  snapshot live in the browser's `localStorage` and nowhere else.

## Notifications

Browser notifications work today: no server, no push service, no subscription
records, which suits an app with no accounts. Enable them in Settings.

The rules — which alerts deserve to interrupt someone — live in
`lib/notifications/client.ts`, deliberately separate from delivery, so adding
web push or email later is a new transport against the same rules rather than a
second copy of them. Critical and important alerts notify; public-safety
advisories also notify when that category is enabled, since a newly found
checkpoint announcement is the one thing here a user explicitly asked to be told
about. Each alert notifies once per session, and the alerts present on first
load are marked seen rather than announced.

## Deployment

Vercel, root directory left at the repository root, deploying from `main`. Set
the environment variables you need in the Vercel project — at minimum
`NWS_USER_AGENT`, and `COMMAND_CENTER_PASSCODE` if the deployment is publicly
reachable.

Every Command Center page that reads live data is `force-dynamic`. Without it
Next prerenders them at build time, and "no publicly announced checkpoints found
in monitored sources" frozen at deploy time would be the most misleading thing
this app could say.

## Adding a module

1. Add a provider under `lib/` that fetches and normalises the data.
2. Add a service that wraps it in a `ModuleSnapshot` — data, status, timestamp,
   sources, alerts and a one-line summary built only from values it has.
3. Register it in `lib/modules/registry.ts` for navigation and Today's section
   ordering.
4. Fetch it in `lib/intelligence/commandCenter.ts`. The day status, briefing and
   Alert Center pick it up from there.

Planned, with the architecture in place and no implementation yet: Outdoor,
Calendar, News, Home, Fishing, Travel, Sports.

## Adding a data source

Add an entry to `SOURCES` in `lib/sources/registry.ts` with its transport
(`rss`, `html`, `api` or `manual`), agency, default enabled state and a note
about its reliability. It appears in Settings with live status immediately. RSS
and Atom are parsed by `lib/sources/feed.ts`; an `api` source needs a parser
alongside it.

---

## Known limitations

- **Road conditions and reported incidents need `PENNDOT_API_KEY`.** Without it
  there is no incident feed, and the app says so rather than showing an empty
  incident list as good news.
- **511PA's API contract may have moved** since this was written; the parser is
  defensive and the module fails loudly rather than quietly.
- **Lightning and traffic tile overlays** on the radar need commercial feeds;
  both are shown as disabled with the reason.
- **HERE routes have no map geometry** (flexible-polyline decoding not
  implemented).
- **Several public-safety sources are HTML**, read best-effort. Municipal police
  departments and the PA DUI Association publish no machine-readable feed and
  are listed as `manual`.
- **Pollen** is not published for North America by the air-quality provider.
- **Web push and email notifications** are not implemented; the rules are in
  place for them.
- **The first server render of Today uses default settings** — settings live in
  the browser — so the first client refresh applies your own arrival time and
  thresholds. Only the departure calculation differs between the two.
