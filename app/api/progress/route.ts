import { NextRequest, NextResponse } from "next/server";
import { COOKIE, readSession } from "@/lib/session";
import { db } from "@/lib/db";
import { findLesson } from "@/lib/content";

const who = (req: NextRequest) => readSession(req.cookies.get(COOKIE)?.value);

/** GET returns the signed-in member's progress; 501 tells the client to use local storage instead. */
export async function GET(req: NextRequest) {
  const sql = db(), me = who(req);
  if (!sql || !me) return NextResponse.json({ error: "Server progress is not enabled." }, { status: 501 });
  const rows = await sql<{ lesson_id: string; score: number }[]>`select lesson_id, score from lesson_progress where member_id = ${me.sub}`;
  const m = await sql<{ drill: number }[]>`select drill from members where member_id = ${me.sub}`;
  const done: Record<string, { score: number }> = {};
  rows.forEach((r) => (done[r.lesson_id] = { score: r.score }));
  return NextResponse.json({ done, drill: m[0]?.drill ?? 0, name: me.name });
}

export async function POST(req: NextRequest) {
  const sql = db(), me = who(req);
  if (!sql || !me) return NextResponse.json({ error: "Server progress is not enabled." }, { status: 501 });
  const b = (await req.json().catch(() => ({}))) as { type?: string; lessonId?: string; score?: number; n?: number };
  if (b.type === "lesson" && b.lessonId && findLesson(b.lessonId) && Number.isInteger(b.score) && b.score! >= 0 && b.score! <= 10) {
    await sql`insert into lesson_progress (member_id, lesson_id, score) values (${me.sub}, ${b.lessonId}, ${b.score!})
      on conflict (member_id, lesson_id) do update set score = greatest(lesson_progress.score, excluded.score), completed_at = now()`;
    return NextResponse.json({ ok: true });
  }
  if (b.type === "drill" && Number.isInteger(b.n) && b.n! >= 0) {
    await sql`update members set drill = ${b.n!} where member_id = ${me.sub}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid progress update." }, { status: 400 });
}
