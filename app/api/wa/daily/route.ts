import { NextRequest, NextResponse } from "next/server";
import { sendButtons, sendTemplate } from "@/lib/wa";
import { markCheckin, pendingCheckins, tipSubscribers } from "@/lib/wa-store";

export const maxDuration = 60;

/** Called by Vercel Cron each morning. Opens the 24-hour window with the approved template; the tip follows when they tap. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const template = process.env.WA_DAILY_TEMPLATE || "pocket_coach_daily";
  const subs = await tipSubscribers();
  let sent = 0;
  for (const u of subs) { await sendTemplate(u.phone, template, [u.name], "tip_today"); sent++; }
  // Morning check-in on the customer conversation each distributor asked about yesterday (only inside WhatsApp's 24-hour window).
  let checkins = 0;
  for (const u of await pendingCheckins()) {
    await sendButtons(u.phone, `Good morning ${u.name}! Yesterday you asked me about: "${u.last_scenario}". How did it go with your customer?`, [
      { id: "ci_good", title: "It went well" }, { id: "ci_hard", title: "It was hard" }, { id: "ci_wait", title: "Not yet" },
    ]);
    await markCheckin(u.phone);
    checkins++;
  }
  return NextResponse.json({ sent, checkins });
}
