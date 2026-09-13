import { TodayScreen } from "@/components/command-center/TodayScreen";
import { isAuthorized } from "@/lib/auth";
import { getCommandCenter } from "@/lib/intelligence/commandCenter";

/**
 * Assembled on every request.
 *
 * Nothing on this page is safe to prerender: it is entirely made of readings
 * that are only true for a few minutes, and a build-time snapshot would be a
 * dashboard showing the weather from whenever the deploy happened.
 */
export const dynamic = "force-dynamic";

/**
 * Today, server-rendered with real data.
 *
 * The aggregate is assembled here rather than fetched by the browser, so the
 * first paint is the finished dashboard rather than a page of skeletons that
 * fills in a second later. The client hook then takes over and refreshes it.
 *
 * Settings are not available on the server — they live in the browser — so the
 * first render uses the defaults and the first client refresh applies the
 * user's own arrival time and thresholds. For everything except the departure
 * calculation the two are identical, which is why this is worth the trade.
 */
export default async function TodayPage() {
  const data = await getCommandCenter({
    authorized: await isAuthorized(),
    trimSeries: true,
  });

  return <TodayScreen initial={data} />;
}
