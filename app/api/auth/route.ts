import { closeGate, gateEnabled, gateMode, isAuthorized, openGate } from "@/lib/auth";
import { jsonResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Whether this deployment has a gate, and whether this browser is through it. */
export async function GET() {
  return jsonResponse({
    gateEnabled: gateEnabled(),
    mode: gateMode(),
    authorized: await isAuthorized(),
  });
}

export async function POST(request: Request) {
  let passcode = "";
  try {
    const body = (await request.json()) as { passcode?: unknown };
    if (typeof body.passcode === "string") passcode = body.passcode;
  } catch {
    return jsonResponse({ ok: false, message: "Expected a JSON body." }, 400);
  }

  if (!passcode) {
    return jsonResponse({ ok: false, message: "Enter the passcode." }, 400);
  }

  const result = await openGate(passcode);
  // A wrong passcode is a 401 so the client can tell it apart from a network
  // failure, but the message never hints at what the passcode looks like.
  return jsonResponse(result, result.ok ? 200 : 401);
}

export async function DELETE() {
  await closeGate();
  return jsonResponse({ ok: true });
}
