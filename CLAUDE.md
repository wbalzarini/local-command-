# Project: Command Center — Personal Intelligence Dashboard

A personal daily dashboard for one place and one commute, built to answer a
single question the moment it opens: what do I need to know about today?

Weather, barometric pressure, radar, official severe-weather alerts, a
traffic-aware commute with alternates and a departure time, road conditions,
publicly announced public-safety information, and a daily briefing assembled
from all of it — plus a "what changed" list.

Location: Avondale, Pennsylvania 19311. Commute: Avondale → JPMorgan Chase,
500 Stein Christiana Road, Newark, Delaware.

## Stack
- Next.js (App Router) + React + TypeScript + Tailwind CSS, at the repo root
- Icons: lucide-react. Maps: Leaflet, dynamically imported.
- Charts and gauges are hand-rolled SVG. No charting dependency — keep it that way.
- Hosting: Vercel, root directory = repo root, deploys from `main`

## Commands
- `npm install`
- `npm run dev` — local dev server on :3000
- `npm run build` — production build; must pass before any PR
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint`
- `DEMO_MODE=1 npm run dev` — labelled sample data, no network needed

## Rules
- Never commit directly to `main`. One branch per feature: `feat/<short-name>`.
- Run the production build locally before pushing. A failing build = failing deploy.
- Never hardcode API keys. Read from environment variables; list each one in `.env.example`.
- Don't add dependencies without saying why in the PR description.
- No auth and no database unless someone asks for one. The passcode gate is a
  front-door lock, not an identity system.

## Architecture rules
- Every module returns a `ModuleSnapshot<T>` (`types/index.ts`): data, status,
  timestamp, sources, alerts, summary. Screens read modules only through a
  service in `lib/*/service.ts` — never a provider or a demo generator straight
  from a component, so swapping a simulated feed for a real API stays a
  one-file change.
- **Never turn "we could not ask" into "there is nothing".** `unavailable` is a
  distinct state from an empty result, and the UI must render them differently.
  This is the single most important rule in this codebase.
- Cross-module reasoning lives only in `lib/intelligence/commandCenter.ts`.
  Modules stay independent of each other.
- Pages that read live data must be `force-dynamic`; prerendering them freezes
  readings at build time.
- Provider calls are bounded by `lib/cache.ts`, not by HTTP caching. API
  responses are `no-store` so the "last updated" stamp cannot lie.

## Data rules
- Severe weather alerts come from the National Weather Service only, never from
  the forecast provider.
- `DEMO_MODE=1` sample data is always badged. Never present generated numbers
  as observations. Severe-weather alerts, radar imagery and public-safety
  announcements are never simulated, not even in `DEMO_MODE`.
- A routing provider with no traffic model reports `delayMinutes: null`, never
  `0`. Zero is a claim; null is the truth.
- The road-conditions module reports "not configured" or "failed" when it
  cannot read a feed. It never reports that the roads are clear.

## Public safety rules
This module aggregates published announcements and nothing more.
- Never infer, predict or estimate unannounced enforcement.
- Never state that no checkpoint exists. Say whether anything was found in the
  monitored sources, and how many of those sources answered.
- Always show the source link and the standard disclaimer from
  `lib/sources/types.ts`.
- Mark any field an announcement did not state as not stated. Never narrow a
  published area to something more specific.
- Sanitise all external text through `lib/sources/sanitize.ts` before rendering.
- Sources with no machine-readable feed are listed as `manual`, not scraped
  speculatively.

## Privacy rules
- All provider calls are server-side. No key and no home address may reach a
  client bundle.
- `HOME_ADDRESS` is read on the server to build routes. It is never geocoded
  and never returned by an API route. Only the work address is geocoded.
- Home coordinates default to the borough centroid, not a street address.
- With `COMMAND_CENTER_PASSCODE` set, the commute and road modules return
  `locked` as data, so the route cannot leak through a component that forgot to
  check.
- Settings and the dashboard snapshot live in the browser's localStorage only.
  No accounts, no database, no analytics.
