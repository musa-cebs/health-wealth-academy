import { NextRequest, NextResponse } from "next/server";
import { COOKIE, signSession, verifySsoToken } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const user = verifySsoToken(url.searchParams.get("token") ?? "");
  if (!user) return NextResponse.redirect(new URL("/login?error=1", url));
  const sql = db();
  if (sql) {
    try {
      await sql`insert into members (member_id, name, upline_id, role) values (${user.sub}, ${user.name}, ${user.upline ?? null}, ${user.role})
        on conflict (member_id) do update set name = excluded.name, upline_id = excluded.upline_id, role = excluded.role, last_seen = now()`;
    } catch { /* sign-in still works if the database is briefly unavailable */ }
  }
  const next = url.searchParams.get("next") ?? "/";
  const res = NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/", url));
  res.cookies.set(COOKIE, signSession(user), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
  return res;
}
