import { NextRequest, NextResponse } from "next/server";
import { anthropic, guard, MODEL, FACTS, RUBRIC_TEXT, REDFLAG_TEXT } from "@/lib/ai";
import { getPersona } from "@/lib/personas";
import { FRAMEWORK } from "@/lib/content";
import type { Msg } from "@/lib/types";
import { COOKIE, readSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const blocked = guard(req); if (blocked) return blocked;
  const { personaId, messages } = (await req.json().catch(() => ({}))) as { personaId?: string; messages?: Msg[] };
  const persona = personaId ? getPersona(personaId) : null;
  if (!persona || !Array.isArray(messages) || messages.length < 2 || messages.length > 40) return NextResponse.json({ error: "Invalid score request." }, { status: 400 });
  const ai = anthropic();
  if (!ai) return NextResponse.json({ error: "Scoring is offline: ANTHROPIC_API_KEY is not set." }, { status: 503 });

  const transcript = messages.map((m) => `${m.role === "user" ? "DISTRIBUTOR" : "CUSTOMER"}: ${m.content}`).join("\n");
  const names = FRAMEWORK.rubric.map(([n]) => n);
  const system = `You mark a training roleplay between a health-supplement DISTRIBUTOR (the learner) and a simulated CUSTOMER, using the Health & Wealth care-first CLOSER method. Be fair, specific and kind. Mark only what the DISTRIBUTOR did. A step not reached in the conversation scores 0 for that step.

RUBRIC (step, max marks, what good looks like)
${RUBRIC_TEXT}

RED FLAGS (any one means the attempt fails automatically; list the exact quote)
${REDFLAG_TEXT}

APPROVED FACTS
${FACTS}

Respond with ONLY valid JSON, no prose, in this exact shape:
{"scores":{${names.map((n) => `"${n}":number`).join(",")}},"red_flags":[{"flag":"string","quote":"string"}],"strengths":["string"],"improve":["string"],"summary":"string"}
Each score must be an integer between 0 and that step's maximum. Keep every string under 25 words, with at most 3 strengths and 3 improvements, and at most 3 red flags.`;
  let raw = "";
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 2500, system, messages: [{ role: "user", content: `Customer persona: ${persona.name}. ${persona.blurb}\n\nTRANSCRIPT\n${transcript}` }] });
    raw = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    console.error("score: model call failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Scoring failed. Please try again.", reason: "model_call" }, { status: 502 });
  }
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const rows = FRAMEWORK.rubric.map(([n, max]) => ({ name: n, max, score: Math.max(0, Math.min(max, Math.round(Number(json.scores?.[n] ?? 0)))) }));
    const total = rows.reduce((a, x) => a + x.score, 0);
    const redFlags = Array.isArray(json.red_flags) ? json.red_flags : [];
    const pass = total >= 75 && redFlags.length === 0;
    const sql = db(), me = readSession(req.cookies.get(COOKIE)?.value);
    if (sql && me) { try { await sql`insert into roleplay_attempts (member_id, persona, total, pass, red_flags) values (${me.sub}, ${persona.id}, ${total}, ${pass}, ${JSON.stringify(redFlags)}::jsonb)`; } catch {} }
    return NextResponse.json({ rows, total, pass, redFlags, strengths: json.strengths ?? [], improve: json.improve ?? [], summary: json.summary ?? "" });
  } catch (e) {
    console.error("score: could not parse model output", e instanceof Error ? e.message : e, raw.slice(0, 300));
    return NextResponse.json({ error: "Scoring failed. Please try again.", reason: "parse" }, { status: 502 });
  }
}
