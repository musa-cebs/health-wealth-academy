import { after, NextRequest, NextResponse } from "next/server";
import { parseIncoming, validSignature } from "@/lib/wa";
import { handleIncoming } from "@/lib/pocket-coach";

export const maxDuration = 60;

/** Meta's webhook verification handshake. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && process.env.WA_VERIFY_TOKEN && q.get("hub.verify_token") === process.env.WA_VERIFY_TOKEN) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Acknowledge immediately, then do the coaching work after the response is sent. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!validSignature(raw, sig)) {
    console.warn("wa webhook rejected: bad signature", { hasHeader: !!sig, hasSecret: !!process.env.WA_APP_SECRET, bytes: raw.length });
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse("Bad request", { status: 400 }); }
  const messages = parseIncoming(payload);
  const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  console.log("wa webhook", { messages: messages.length, statuses: value?.statuses?.length ?? 0, to: String(value?.metadata?.display_phone_number ?? "").slice(-4) });
  after(async () => {
    for (const m of messages) {
      try { await handleIncoming(m); } catch (e) { console.error("wa handler", e instanceof Error ? e.message : e); }
    }
  });
  return NextResponse.json({ ok: true });
}
