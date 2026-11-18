import { anthropic, MODEL } from "@/lib/ai";
import { coachSystem, type Member } from "@/lib/pocket-coach-prompt";
import { verifyMember } from "@/lib/members";
import { fetchMedia, markRead, sendButtons, sendImage, sendList, sendText, type Incoming } from "@/lib/wa";
import { extractCards, imageUrl, splitParts, trimToComplete } from "@/lib/product-cards";
import { bumpDrill, firstSeen, getUser, history, remember, saveScenario, saveUser, setActivity, setMode, setTipDay, setTips, touch, type WaUser } from "@/lib/wa-store";
import { allTracks, drillAt, drillCount, getLesson, itemsInTrack, isPlaybook, lessonId, searchLesson, trackById, trainingContext, type Item } from "@/lib/training";
import { nextDay, practiseSeed, sayItText, tipFor, tipText } from "@/lib/tips";

const WELCOME = (name: string) =>
  `Hi ${name}! I'm your *Pocket Coach* 💚 from Health Sweets Academy. Ask me anything mid-conversation: a customer's situation, a tough objection, or paste a message to check it before you send. I reply in seconds.\n\nOur team may review chats to improve this service. Type STOP any time to switch off daily tips.\n\nDo you have a specific question you would like to ask?`;

export const TECH_ERROR = "⚠️ Technical error. The Pocket Coach hit a problem on our side, not yours. Please try again in a minute. If it keeps happening, let your upline know.";

const TIPS_OFFER = "One more thing: would you like a short daily tip each morning, plus a quick check-in on your customer chats?";

const MENU_ROWS = [
  { id: "m_customer", title: "Help with a customer", description: "Describe their situation" },
  { id: "m_objection", title: "Handle an objection", description: "Get a ready reply" },
  { id: "m_check", title: "Check my message", description: "Is it safe to send?" },
  { id: "m_follow", title: "Follow-up message", description: "Day 1, week 1, month 1..." },
  { id: "m_teach", title: "Teach me", description: "Short lessons and skills" },
  { id: "m_drill", title: "Drill me", description: "Practise a real scenario" },
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

const CLOSE_TRAINING = "Well done. Type TEACH ME for a lesson, DRILL for a practice scenario, or just ask me anything about a customer. 💚";

async function showTracks(u: WaUser) {
  await sendList(u.phone, "What would you like to learn? Pick a track, or type TEACH ME followed by a topic (for example: TEACH ME objections).", "Choose a track",
    allTracks().map((t) => ({ id: `t:${t.id}`, title: t.short, description: t.desc })));
}

async function showTrack(u: WaUser, trackId: string) {
  const t = trackById(trackId);
  if (!t) return showTracks(u);
  await sendList(u.phone, `${t.name}: which topic?`, "Choose a topic",
    itemsInTrack(trackId).map((i) => ({ id: `l:${lessonId(i)}`, title: i.short, description: (isPlaybook(i) ? i.title : i.summary) })));
}

async function startLesson(u: WaUser, member: Member, item: Item) {
  await setActivity(u.phone, { lesson: lessonId(item) });
  u.lesson_id = lessonId(item); u.drill_id = null;
  const seed = `Teach me: ${item.title}`;
  await ask(u, member, [{ type: "text", text: seed }], seed);
}

async function startDrill(u: WaUser) {
  const d = drillAt(u.drill_idx);
  await setActivity(u.phone, { drill: d.id });
  u.drill_id = d.id; u.lesson_id = null;
  const msg = `*Drill ${(((u.drill_idx % drillCount) + drillCount) % drillCount) + 1} of ${drillCount} · ${d.focus}*\n\n${d.scenario}\n\nWhat would you ask or say next? Reply by typing it out. Type DONE to stop.`;
  await sendText(u.phone, msg);
  await remember(u.phone, "assistant", msg);
}

async function endActivity(u: WaUser) {
  await setActivity(u.phone, {});
  u.lesson_id = null; u.drill_id = null;
}

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };

async function ask(u: WaUser, member: { id: string; name: string; upline?: string }, content: Block[], remembered: string) {
  const ai = anthropic();
  if (!ai) { await sendText(u.phone, TECH_ERROR); return; }
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
  const recentTexts = [remembered, ...past.filter((t) => t.role === "user").slice(-2).map((t) => t.content)];
  const extra = trainingContext({ mode: u.mode, lessonId: u.lesson_id, drillId: u.drill_id, recentTexts });
  try {
    const r = await ai.messages.create({ model: MODEL, max_tokens: 2000, system: coachSystem(member, extra), messages: turns as never });
    let reply = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (r.stop_reason === "max_tokens") { console.warn("coach reply hit the length limit; trimmed"); reply = trimToComplete(reply); }
    const handoff = /HANDOFF_REQUEST:true/.test(reply);
    reply = reply.replace(/^HANDOFF_REQUEST:true\s*$/gm, "").trim();
    const lessonDone = /^LESSON_DONE\s*$/m.test(reply), drillDone = /^DRILL_DONE\s*$/m.test(reply);
    reply = reply.replace(/^(LESSON_DONE|DRILL_DONE)\s*$/gm, "").trim();
    await remember(u.phone, "user", remembered);
    const { text, cards, after } = extractCards(reply);
    for (const part of splitParts(text)) await sendText(u.phone, part);
    for (const c of cards) await sendImage(u.phone, imageUrl(c.code), c.caption);
    for (const part of splitParts(after)) await sendText(u.phone, part);
    if (text || cards.length || after) await remember(u.phone, "assistant", [text, cards.length ? `[product cards sent: ${cards.map((c) => c.code).join(", ")}]` : "", after].filter(Boolean).join("\n"));
    if (cards.length && !u.lesson_id && !u.drill_id) await saveScenario(u.phone, remembered);
    if (lessonDone) {
      await endActivity(u);
      await sendButtons(u.phone, "Nicely done. What next?", [{ id: "m_teach", title: "Another lesson" }, { id: "m_drill", title: "Drill me" }, { id: "act_done", title: "Done for now" }]);
    }
    if (drillDone) {
      await endActivity(u); await bumpDrill(u.phone);
      await sendButtons(u.phone, "Ready for the next scenario?", [{ id: "drill_next", title: "Next drill" }, { id: "m_teach", title: "Teach me" }, { id: "act_done", title: "That's enough" }]);
    }
    if (handoff) await sendText(u.phone, "I've flagged this so a person can follow up. In the meantime, you can message your upline directly.");
  } catch (e) {
    console.error("coach error", e instanceof Error ? e.message : e);
    await sendText(u.phone, TECH_ERROR);
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
    const access = await verifyMember(m.from);
    console.log("wa new sender", { from: who, verified: access.ok, reason: access.ok ? undefined : access.reason });
    if (!access.ok) {
      await sendText(m.from, access.reason === "error"
        ? TECH_ERROR
        : "The Pocket Coach is for registered Health & Wealth distributors. Please ask your upline to get you set up, then message me again.");
      return;
    }
    member = access.member;
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
    if (id === "m_teach") { await showTracks(u); return; }
    if (id === "m_drill" || id === "drill_next") { await startDrill(u); return; }
    if (id === "act_done") { await endActivity(u); await sendText(u.phone, CLOSE_TRAINING); return; }
    if (id.startsWith("t:")) { await showTrack(u, id.slice(2)); return; }
    if (id.startsWith("l:")) { const item = getLesson(id.slice(2)); if (item) await startLesson(u, member!, item); else await showTracks(u); return; }
    if (id.startsWith("ci_")) {
      const what = u.last_scenario ?? "my customer";
      const how = id === "ci_good" ? "it went well" : id === "ci_hard" ? "it was hard and I struggled" : "I have not spoken to them yet";
      const seed = `Debrief: yesterday I asked you about this customer: "${what}". ${how[0].toUpperCase() + how.slice(1)}. Help me learn from it.`;
      await ask(u, member!, [{ type: "text", text: seed }], seed);
      return;
    }
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
    if (upper === "QUICK") { await setMode(u.phone, "quick"); await sendText(u.phone, "⚡ Quick mode on: short answers, no teaching notes. Type FULL to bring the coaching back."); return; }
    if (upper === "FULL") { await setMode(u.phone, "coach"); await sendText(u.phone, "🎓 Full coaching is back on: I'll explain the why and the questions behind every answer. Type QUICK any time for short answers."); return; }
    if (upper === "DRILL") { await startDrill(u); return; }
    if (upper === "DONE" && (u.lesson_id || u.drill_id)) { await endActivity(u); await sendText(u.phone, CLOSE_TRAINING); return; }
    if (upper === "TEACH" || upper.startsWith("TEACH ME") || upper.startsWith("TEACH ")) {
      const topic = text.replace(/^teach( me)?/i, "").replace(/^[\s:,-]+/, "").trim();
      const item = topic ? searchLesson(topic) : null;
      if (item) await startLesson(u, member!, item); else await showTracks(u);
      return;
    }
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
