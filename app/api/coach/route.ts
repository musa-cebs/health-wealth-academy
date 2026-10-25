import { NextRequest, NextResponse } from "next/server";
import { anthropic, guard, MODEL, FACTS, curriculumDigest, libraryDigest } from "@/lib/ai";
import { findLesson } from "@/lib/content";

const SYSTEM = `You are the Health & Wealth Academy coach, helping distributors learn. Answer ONLY from the approved content below. If the answer is not there, say so plainly and suggest asking their upline or trainer; never invent product claims, ingredients, prices or income figures. Keep answers short (under 120 words), warm, in plain language, and use safe wording ("supports", "helps"). End by pointing to the most relevant lesson when one fits.

APPROVED CONTENT
${FACTS}

LESSONS
${curriculumDigest()}

LIBRARY
${libraryDigest()}`;

export async function POST(req: NextRequest) {
  const blocked = guard(req); if (blocked) return blocked;
  const { question, lessonId } = (await req.json().catch(() => ({}))) as { question?: string; lessonId?: string };
  if (!question || question.length > 500) return NextResponse.json({ error: "Ask a question of up to 500 characters." }, { status: 400 });
  const ai = anthropic();
  if (!ai) return NextResponse.json({ error: "Coach is offline: ANTHROPIC_API_KEY is not set." }, { status: 503 });
  const lesson = lessonId ? findLesson(lessonId) : null;
  const context = lesson ? `The learner is on lesson L${lesson.id} ${lesson.title}.\n` : "";
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 400, system: SYSTEM, messages: [{ role: "user", content: context + question }] });
    const text = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return NextResponse.json({ answer: text });
  } catch (e) {
    return NextResponse.json({ error: "The coach could not answer right now. Please try again." }, { status: 502 });
  }
}
