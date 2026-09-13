import { jsonResponse, NO_STORE } from "@/lib/api";
import { isAuthorized } from "@/lib/auth";
import { getCommandCenter } from "@/lib/intelligence/commandCenter";
import { parseClientSnapshot } from "@/lib/intelligence/snapshot";
import { settingsFromParams } from "@/lib/settings/params";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The Today page's single request.
 *
 * Everything the dashboard needs in one aggregate: each module's snapshot, the
 * ranked alert list, the day status, the briefing and the change list. One
 * request rather than eight means the page paints once with a consistent view,
 * instead of eight cards arriving in an arbitrary order with timestamps that
 * disagree.
 *
 * GET compares against the server's previous assembly. POST accepts the
 * client's own last snapshot in the body, which is the better comparison:
 * "what changed" should mean "since you last looked", and only the browser
 * knows when that was.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await getCommandCenter({
      settings: settingsFromParams(searchParams),
      authorized: await isAuthorized(),
      trimSeries: searchParams.get("full") !== "1",
    });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);

  let snapshot = null;
  try {
    const body = (await request.json()) as { snapshot?: unknown };
    snapshot = parseClientSnapshot(body.snapshot);
  } catch {
    // A missing or unreadable body is not an error; it just means there is
    // nothing to compare against yet.
    snapshot = null;
  }

  try {
    const data = await getCommandCenter({
      settings: settingsFromParams(searchParams),
      authorized: await isAuthorized(),
      clientSnapshot: snapshot,
      trimSeries: searchParams.get("full") !== "1",
    });
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const message =
    error instanceof Error ? error.message : "The dashboard could not be assembled.";
  return jsonResponse({ error: message }, 502);
}
