import { NextResponse } from "next/server";
import type { ModuleSnapshot } from "@/types";

/**
 * Shared plumbing for the module API routes.
 *
 * Every route returns a `ModuleSnapshot`, including when the underlying
 * provider failed: a module that cannot answer still has a status, a timestamp
 * and a summary, and that is what the UI renders. A 500 would tell the client
 * nothing except that something broke somewhere, so the only thing that
 * produces a non-200 here is a genuinely malformed request.
 */

/**
 * Responses are never cached at the edge.
 *
 * Provider call rates are bounded by lib/cache.ts, which also keeps the last
 * good value. A CDN cache on top of that would make the "last updated" stamp
 * on screen lie about when the data was actually read.
 */
export const NO_STORE = { "Cache-Control": "no-store, must-revalidate" } as const;

export function snapshotResponse<T>(snapshot: ModuleSnapshot<T>): NextResponse {
  return NextResponse.json(snapshot, { headers: NO_STORE });
}

export function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Wraps a handler so an unexpected throw becomes a snapshot-shaped error.
 *
 * The shape matters: the client renders `status.message` in the module's error
 * state, so an unhandled bug surfaces in the same place as a provider outage
 * rather than as a blank card.
 */
export async function withModuleErrors<T>(
  id: string,
  label: string,
  handler: () => Promise<ModuleSnapshot<T>>,
): Promise<NextResponse> {
  try {
    return snapshotResponse(await handler());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json(
      {
        id,
        label,
        data: null,
        status: { state: "unavailable", message },
        timestamp: Date.now(),
        sources: [],
        alerts: [],
        summary: `${label} data is unavailable.`,
      } satisfies ModuleSnapshot<T>,
      { status: 200, headers: NO_STORE },
    );
  }
}
