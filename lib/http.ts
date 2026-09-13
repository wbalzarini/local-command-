/**
 * One fetch wrapper for every outbound provider call.
 *
 * Providers fail in ways a dashboard has to survive: a timeout, a 429, HTML
 * where JSON was promised. Each of those comes back here as a typed failure so
 * a module can report "unavailable" honestly instead of throwing and blanking
 * the page.
 */

export type FetchFailure = {
  ok: false;
  kind: "timeout" | "network" | "http" | "parse" | "rate-limit";
  status?: number;
  message: string;
};

export type FetchSuccess<T> = { ok: true; value: T };

export type FetchResult<T> = FetchSuccess<T> | FetchFailure;

export type FetchOptions = {
  /** Milliseconds before the request is abandoned. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Seconds Next may reuse the response for. 0 disables the data cache. */
  revalidate?: number;
  signal?: AbortSignal;
  method?: "GET" | "POST";
  /** JSON body, for the providers that only offer a POST endpoint. */
  body?: unknown;
};

const DEFAULT_TIMEOUT_MS = 8_000;

async function request(
  url: string,
  options: FetchOptions,
): Promise<FetchResult<Response>> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      // A revalidate of 0 means "always ask", which is right for anything
      // already cached a layer up by lib/cache.ts.
      next:
        options.revalidate === undefined
          ? undefined
          : { revalidate: options.revalidate },
    });

    if (!response.ok) {
      return {
        ok: false,
        kind: response.status === 429 ? "rate-limit" : "http",
        status: response.status,
        message: `${response.status} ${response.statusText}`.trim(),
      };
    }

    return { ok: true, value: response };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      ok: false,
      kind: aborted ? "timeout" : "network",
      message: aborted
        ? "Request timed out"
        : error instanceof Error
          ? error.message
          : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult<T>> {
  const response = await request(url, options);
  if (!response.ok) return response;

  try {
    return { ok: true, value: (await response.value.json()) as T };
  } catch {
    return { ok: false, kind: "parse", message: "Response was not valid JSON" };
  }
}

export async function fetchText(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResult<string>> {
  const response = await request(url, {
    ...options,
    headers: { Accept: "text/html,application/xhtml+xml,application/xml", ...options.headers },
  });
  if (!response.ok) return response;

  try {
    return { ok: true, value: await response.value.text() };
  } catch {
    return { ok: false, kind: "parse", message: "Response body could not be read" };
  }
}

/** Human-readable reason, for the "why is this module empty" line in the UI. */
export function failureMessage(failure: FetchFailure): string {
  switch (failure.kind) {
    case "timeout":
      return "Provider did not respond in time";
    case "rate-limit":
      return "Provider rate limit reached";
    case "http":
      return `Provider returned ${failure.status ?? "an error"}`;
    case "parse":
      return "Provider returned an unreadable response";
    default:
      return "Provider could not be reached";
  }
}
