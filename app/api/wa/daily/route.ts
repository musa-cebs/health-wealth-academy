import { NextRequest, NextResponse } from "next/server";
import { sendTemplate } from "@/lib/wa";
import { tipSubscribers } from "@/lib/wa-store";

export const maxDuration = 60;

/** Called by Vercel Cron each morning. Opens the 24-hour window with the approved template; the tip follows when they tap. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const template = process.env.WA_DAILY_TEMPLATE || "pocket_coach_daily";
  const subs = await tipSubscribers();
  let sent = 0;
  for (const u of subs) { await sendTemplate(u.phone, template, [u.name]); sent++; }
  return NextResponse.json({ sent });
}
