"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

/**
 * The passcode prompt.
 *
 * Shown wherever a module comes back `locked`. The copy states why the gate
 * exists — the route identifies where the user lives — because a lock with no
 * explanation reads as a paywall rather than a privacy measure.
 */
export function PasscodeGate({
  onUnlocked,
  kind = "passcode",
  message,
}: {
  onUnlocked: () => void;
  /** `unconfigured` means no passcode exists, so there is nothing to type. */
  kind?: "passcode" | "unconfigured";
  message?: string;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A gate with no passcode configured cannot be opened by anyone, so offering
  // an input would be a dead end. It explains what to set instead.
  if (kind === "unconfigured") {
    return (
      <div className="flex items-start gap-2 py-2">
        <Lock className="mt-0.5 size-4 shrink-0 text-level-moderate" aria-hidden="true" />
        <div>
          <p className="text-[12px] leading-snug text-muted">{message}</p>
          <p className="mt-2 text-[11px] leading-snug text-faint">
            Set <code className="text-fg">COMMAND_CENTER_PASSCODE</code> in the
            deployment&apos;s environment variables and redeploy. Until then the
            route stays hidden rather than public.
          </p>
        </div>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string };

      if (response.ok && body.ok) {
        setPasscode("");
        onUnlocked();
      } else {
        setError(body.message ?? "Incorrect passcode.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="py-2">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 size-4 shrink-0 text-level-unknown" aria-hidden="true" />
        <p className="text-[12px] leading-snug text-muted">
          {message ??
            "Commute details are protected on this deployment. The route traces the way from your home to your work address, so it stays behind the passcode."}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="Passcode"
          autoComplete="current-password"
          className="min-w-0 flex-1 border hairline border-line bg-ink px-2 py-1.5 font-mono text-[13px] text-fg placeholder:text-faint"
          aria-label="Passcode"
        />
        <button
          type="submit"
          disabled={busy || !passcode}
          className="border border-line-strong bg-raised px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-fg uppercase transition-colors hover:bg-line disabled:opacity-40"
        >
          {busy ? "…" : "Unlock"}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] text-level-severe" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
