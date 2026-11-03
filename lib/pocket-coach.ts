import { anthropic, MODEL } from "@/lib/ai";
import { coachSystem, type Member } from "@/lib/pocket-coach-prompt";
import { verifyMember } from "@/lib/members";
import { fetchMedia, markRead, sendButtons, sendImage, sendList, sendText, type Incoming } from "@/lib/wa";
import { extractCards, imageUrl } from "@/lib/product-cards";
import { firstSeen, getUser, history, remember, saveUser, setTipDay, setTips, touch, type WaUser } from "@/lib/wa-store";
import { nextDay, practiseSeed, sayItText, tipFor, tipText } from "@/lib/tips";

const WELCOME = (name: string) =>
  `Hi ${name}! I'm your *Pocket Coach* 💚 from Health Sweets Academy. Ask me anything mid-conversation: a customer's situation, a tough objection, or paste a message to check it before you send. I reply in seconds.\n\nOur team may review chats to improve this service. Type STOP any time to switch off daily tips.\n\nDo you have a specific question you would like to ask?`;

const TIPS_OFFER = "One more thing: would you like a short daily tip each morning?";

const MENU_ROWS = [
  { id: "m_customer", title: "Help with a customer", description: "Describe their situation" },
  { id: "m_objection", title: "Handle an objection", description: "Get a ready reply" },
  { id: "m_check", title: "Check my message", description: "Is it safe to send?" },
  { id: "m_follow", title: "Follow-up message", description: "Day 1, week 1, month 1..." },
  { id: "m_tip", title: "Today's tip", description: "A quick lesson" },
  { id: "m_practise", title: "Practise", description: "Role-play a customer" },
];
const MENU_PROMPTS: Record<string, string> = {
  m_customer: "Tell me about your customer, the way you would tell a colleague: what they are experiencing, for how long, and any medication they take.",
  m_objection: "What is the customer saying? Type their exact words and I'll give you a ready reply.",
  m_check: "Paste the message or post you want checked, and I'll tell you if it is safe to send.",
  m_follow: "Who is the follow-up for, and how long ago did they order? (for example: Mrs M, delivered yesterday)",
  m_practise: "Which situation should we practise? (for example: a customer who says it is too expensive)",
};

async function sendTip(u: WaUser, day: number) {
  const t = tipFor(day);
  await sendButtons(u.phone, tipText(t), [
    { id: `say:${t.day}`, title: "Say it for me" },
    { id: "more", title: "Another one" },
    { id: `prac:${t.day}`, title: "Practise this" },
  ]);
}

/** Sends the next tip in the bank and advances the distributor's position. */
export async function sendNextTip(u: WaUser) {
  const day = nextDay(u.tip_day);
  await setTipDay(u.phone, day);
  u.tip_day = day;
  await sendTip(u, day);
}

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };

async function ask(u: WaUser, member: { id: string; name: string; upline?: string }, content: Block[], remembered: string) {
  const ai = anthropic();
  if (!ai) { await sendText(u.phone, "I'm offline for a moment. Please try again shortly."); return; }
  const past = await history(u.phone);
  const turns: { role: "user" | "assistant"; content: string | Block[] }[] = [];
  for (const t of past) {
    const last = turns[turns.length - 1];
    if (last && last.role === t.role && typeof last.content === "string") last.content += "\n" + t.content;
    else turns.push({ role: t.role, content: t.content });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  const lastT = turns[turns.length - 1];
  if (lastT?.role === "user") turns.push({ role: "assistant", content: "(no reply was sent)" });
  turns.push({ role: "user", content });
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 900, system: coachSystem(member), messages: turns as never });
    let reply = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const handoff = /HANDOFF_REQUEST:true/.test(reply);
    reply = reply.replace(/^HANDOFF_REQUEST:true\s*$/gm, "").trim();
    await remember(u.phone, "user", remembered);
    const { text, cards } = extractCards(reply);
    if (text) await sendText(u.phone, text);
    for (const c of cards) await sendImage(u.phone, imageUrl(c.code), c.caption);
    if (text || cards.length) await remember(u.phone, "assistant", [text, cards.length ? `[product cards sent: ${cards.map((c) => c.code).join(", ")}]` : ""].filter(Boolean).join("\n"));
    if (handoff) await sendText(u.phone, "I've flagged this so a person can follow up. In the meantime, you can message your upline directly.");
  } catch (e) {
    console.error("coach error", e instanceof Error ? e.message : e);
    await sendText(u.phone, "Sorry, I couldn't answer just now. Please send that again in a moment.");
  }
}

export async function handleIncoming(m: Incoming) {
  const who = "…" + m.from.slice(-4);
  console.log("wa msg", { kind: m.kind, from: who });
  if (!(await firstSeen(m.id))) { console.log("wa msg duplicate, ignored", { from: who }); return; }
  await markRead(m.id);

  const text = (m.text ?? "").trim();
  const upper = text.toUpperCase();
  let u = await getUser(m.from);
  let member: Member | null = u ? { id: u.member_id, name: u.name, upline: u.upline } : null;
  if (!u) {
    member = await verifyMember(m.from);
    console.log("wa new sender", { from: who, verified: !!member });
    if (!member) {
      await sendText(m.from, "This coach is for registered Health & Wealth distributors. Please ask your upline to get you set up, then message me again.");
      return;
    }
    u = await saveUser({ phone: m.from, member_id: member.id, name: member.name, upline: member.upline ?? "" });
    // Greet first-timers who just say hello; anyone who already asks or taps something gets answered straight away.
    if (m.kind === "text" && ["", "HI", "HELLO", "HEY", "MENU", "?", "HELP", "START"].includes(upper)) {
      await sendText(m.from, WELCOME(member.name));
      await sendButtons(m.from, TIPS_OFFER, [{ id: "tips_yes", title: "Yes, daily tips" }, { id: "tips_no", title: "Not now" }]);
      return;
    }
  }
  const streak = await touch(u);

  if (m.kind === "button") {
    const id = m.actionId ?? "";
    if (id === "tips_yes") { await setTips(u.phone, true); await sendText(u.phone, "Lovely. Your tip arrives each morning. Type MENU any time, or just ask me anything. 💚"); return; }
    if (id === "tips_no") { await sendText(u.phone, "No problem. Type TIP whenever you want one, or just ask me anything."); return; }
    if (id === "tip_today" || id === "m_tip") { await sendNextTip(u); return; }
    if (id === "more") { await sendNextTip(u); return; }
    if (id.startsWith("say:")) { await sendText(u.phone, sayItText(tipFor(Number(id.slice(4))))); return; }
    if (id.startsWith("prac:")) {
      const seed = practiseSeed(tipFor(Number(id.slice(5))));
      await ask(u, member!, [{ type: "text", text: seed }], seed);
      return;
    }
    if (MENU_PROMPTS[id]) { await sendText(u.phone, MENU_PROMPTS[id]); return; }
    return;
  }

  if (m.kind === "text") {
    if (["STOP", "UNSUBSCRIBE"].includes(upper)) { await setTips(u.phone, false); await sendText(u.phone, "Done, no more daily tips. I'm still here whenever you need me. Type START to turn them back on."); return; }
    if (upper === "START") { await setTips(u.phone, true); await sendText(u.phone, "Daily tips are back on. 💚"); return; }
    if (["MENU", "?", "HELP", "HI", "HELLO"].includes(upper)) {
      await sendList(u.phone, `What do you need${streak > 1 ? `? 🔥 ${streak} days in a row` : "?"}`, "Open menu", MENU_ROWS);
      return;
    }
    if (upper === "TIP" || upper === "SHOW ME") { await sendNextTip(u); return; }
    if (!text) return;
    await ask(u, member!, [{ type: "text", text }], text);
    return;
  }

  if (m.kind === "image" && m.mediaId) {
    const img = await fetchMedia(m.mediaId);
    if (!img || !/^image\/(jpeg|png|webp|gif)$/.test(img.mime)) { await sendText(u.phone, "I couldn't open that picture. Could you paste the text instead?"); return; }
    const note = m.text || "Here is a screenshot of my customer chat. Coach me on it.";
    await ask(u, member!, [{ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data } }, { type: "text", text: note }], `[screenshot] ${note}`);
    return;
  }

  if (m.kind === "audio") { await sendText(u.phone, "Voice notes are coming soon. For now, please type it out and I'll help right away. 💚"); return; }
}
