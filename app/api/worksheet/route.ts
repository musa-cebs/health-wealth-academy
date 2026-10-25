import { NextRequest, NextResponse } from "next/server";
import { anthropic, guard, MODEL } from "@/lib/ai";

const SYSTEM = `You are the Health & Wealth Academy coach reviewing a new distributor's short written promise: how they will care for their customers. Our culture: "It is not a hit-and-run. It is a health journey." We love and care for people, before the sale, after the sale, and even beyond products. We never make medical claims (no cure, treat or prevent), never promise income or results, and always send people to a doctor when needed.

Judge the promise on four things: (1) specific: concrete actions, not slogans; (2) sincere: in their own words, caring, not copied; (3) customer-centred: about the customer's wellbeing, not about making sales; (4) safe: no medical or income claims.

Reply with ONLY valid JSON: {"ready":boolean,"strengths":"one short sentence","improve":"one or two short sentences, kind and specific, or an empty string if ready","rewrite_hint":"one example of a more specific action, or an empty string if ready"}. Set ready to true when it is specific, sincere, customer-centred and safe. Be encouraging. Keep every string under 40 words.`;

export async function POST(req: NextRequest) {
  const blocked = guard(req); if (blocked) return blocked;
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  const t = (text ?? "").trim();
  if (t.length < 20 || t.length > 1200) return NextResponse.json({ error: "Write at least a couple of sentences (up to about 200 words)." }, { status: 400 });
  const ai = anthropic();
  if (!ai) return NextResponse.json({ error: "The coach is offline right now. Please try again later." }, { status: 503 });
  let raw = "";
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: `My Health & Wealth promise:\n${t}` }] });
    raw = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    console.error("worksheet: model call failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The coach could not review that right now. Please try again." }, { status: 502 });
  }
  try {
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return NextResponse.json({ ready: Boolean(j.ready), strengths: String(j.strengths ?? ""), improve: String(j.improve ?? ""), hint: String(j.rewrite_hint ?? "") });
  } catch (e) {
    console.error("worksheet: could not parse model output", e instanceof Error ? e.message : e, raw.slice(0, 200));
    return NextResponse.json({ error: "The coach could not review that right now. Please try again." }, { status: 502 });
  }
}
