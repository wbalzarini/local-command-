import { withModuleErrors } from "@/lib/api";
import { getPublicSafety } from "@/lib/sources/service";
import { settingsFromParams } from "@/lib/settings/params";

export const dynamic = "force-dynamic";

/**
 * Publicly announced public-safety information for the monitored county.
 *
 * Not gated by the passcode: nothing here is about the user, it is about what
 * agencies have published. The response always carries the per-source status
 * list and the disclaimer, so "nothing found" is never rendered without the
 * context that makes it truthful.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const settings = settingsFromParams(searchParams);

  return withModuleErrors("public-safety", "Public Safety", () =>
    getPublicSafety(settings.disabledSources ?? []),
  );
}
