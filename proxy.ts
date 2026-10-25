import { NextRequest, NextResponse } from "next/server";
import { COOKIE, authEnabled, readSession } from "@/lib/session";

/** Requires a valid session for everything except the sign-in routes, once SSO_SECRET is configured. */
export function proxy(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/sso") return NextResponse.next();
  if (readSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in from Vendor AI." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
