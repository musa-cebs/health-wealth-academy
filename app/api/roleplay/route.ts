import { NextRequest, NextResponse } from "next/server";
import { anthropic, guard, MODEL } from "@/lib/ai";
import { getPersona } from "@/lib/personas";
import type { Msg } from "@/lib/types";

export async function POST(req: NextRequest) {
  const blocked = guard(req); if (blocked) return blocked;
  const { personaId, messages } = (await req.json().catch(() => ({}))) as { personaId?: string; messages?: Msg[] };
  const persona = personaId ? getPersona(personaId) : null;
  if (!persona || !Array.isArray(messages) || messages.length === 0 || messages.length > 40) return NextResponse.json({ error: "Invalid roleplay request." }, { status: 400 });
  if (messages.some((m) => typeof m.content !== "string" || m.content.length > 1200)) return NextResponse.json({ error: "Message too long." }, { status: 400 });
  const ai = anthropic();
  if (!ai) return NextResponse.json({ error: "Roleplay is offline: ANTHROPIC_API_KEY is not set." }, { status: 503 });

  // In the app the learner (distributor) is "user" and the simulated customer is "assistant", the same as the model sees it.
  // The conversation starts with the customer's opener, so seed a neutral first user turn to satisfy the API.
  const system = `You are playing a CUSTOMER in a training roleplay for a health-supplement distributor in South Africa. Stay in character as a real person chatting on WhatsApp: short messages (1 to 3 sentences), natural, no lists. Never help the distributor or break character. Reveal details only when asked or when it feels natural; do not volunteer your medication unless asked. React honestly: warm and open when the distributor listens and cares, hesitant or sceptical when they push, promise results, or skip questions. If they say something unsafe (for example telling you to stop medication) react as that person naturally would. Reply in the language the distributor uses.\n\nYOUR CHARACTER: ${persona.brief}`;
  const convo = messages[0].role === "assistant" ? [{ role: "user" as const, content: "[The chat has started. Your first message was already sent.]" }, ...messages] : messages;
  if (convo[convo.length - 1].role !== "user") return NextResponse.json({ error: "Waiting for the distributor's message." }, { status: 400 });
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 200, system, messages: toAlternating(convo) });
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ reply: text });
  } catch {
    return NextResponse.json({ error: "The customer could not reply right now. Please try again." }, { status: 502 });
  }
}

/** Merge consecutive same-role turns so the API always receives strict alternation starting with a user turn. */
function toAlternating(t: { role: "user" | "assistant"; content: string }[]) {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of t) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content; else out.push({ ...m });
  }
  return out;
}
