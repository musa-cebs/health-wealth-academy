import { NextRequest, NextResponse } from "next/server";
import { COOKIE, readSession } from "@/lib/session";

/** Who is signed in. Leaders (administrators and executives in Vendor AI) may preview every lesson. */
export async function GET(req: NextRequest) {
  const s = readSession(req.cookies.get(COOKIE)?.value);
  return NextResponse.json({ id: s?.sub ?? "", name: s?.name ?? "", role: s?.role ?? "distributor" });
}
