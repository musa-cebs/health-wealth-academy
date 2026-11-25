import { anthropic, MODEL } from "@/lib/ai";
import { coachSystem, type Member } from "@/lib/pocket-coach-prompt";
import { verifyMember } from "@/lib/members";
import { fetchMedia, fetchMediaBuffer, markRead, sendButtons, sendImage, sendList, sendText, sendVoice, type Incoming } from "@/lib/wa";
import { dailyVoiceLimit, synthesize, transcribe, voiceConfigured } from "@/lib/voice";
import { extractCards, imageUrl, splitParts, trimToComplete } from "@/lib/product-cards";
import { bumpDrill, firstSeen, getUser, history, remember, saveScenario, saveUser, setActivity, setMode, setTipDay, setTips, setVoiceReply, takeVoiceCredit, touch, type WaUser } from "@/lib/wa-store";
import { allTracks, drillAt, drillCount, getLesson, itemsInTrack, isPlaybook, lessonId, playbooksFor, searchLesson, trackById, trainingContext, type Item } from "@/lib/training";
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
  { id: "m_settings", title: "Settings", description: "Daily tips, mode and voice" },
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

type Btn = { id: string; title: string };

async function showMenu(u: WaUser, streak = 0) {
  await sendList(u.phone, `What do you need${streak > 1 ? `? 🔥 ${streak} days in a row` : "?"}`, "Open menu", MENU_ROWS);
}

/** Settings as a tap list. Each row shows the current state, and tapping it flips it. */
async function showSettings(u: WaUser) {
  await sendList(u.phone, "Settings: tap one to switch it.", "Choose a setting", [
    { id: "set_tips", title: `Daily tips: ${u.tips_on ? "ON" : "OFF"}`, description: u.tips_on ? "Tap to switch off" : "Tap to switch on" },
    { id: "set_mode", title: `Mode: ${u.mode === "quick" ? "Quick" : "Full coaching"}`, description: u.mode === "quick" ? "Tap for full coaching" : "Tap for short answers" },
    { id: "set_voice", title: `Voice replies: ${u.voice_reply ? "ON" : "OFF"}`, description: u.voice_reply ? "Tap to switch off" : "Tap to switch on" },
    { id: "m_voice", title: "How voice works", description: "Speak to me, I can answer aloud" },
  ]);
}

/** A message with tap buttons. If the text is too long for a button body, the buttons follow it as their own message. */
async function sendTextWithButtons(phone: string, text: string, buttons: Btn[]) {
  if (text.length <= 1000) { await sendButtons(phone, text, buttons); return; }
  await sendText(phone, text);
  await sendButtons(phone, "What would you like to do next?", buttons);
}

async function afterTraining(u: WaUser) {
  await sendButtons(u.phone, "Well done. What would you like to do next? You can also just ask me about a customer. 💚",
    [{ id: "m_teach", title: "Teach me" }, { id: "m_drill", title: "Drill me" }, { id: "m_menu", title: "Open menu" }]);
}

async function setTipsAndConfirm(u: WaUser, on: boolean) {
  await setTips(u.phone, on); u.tips_on = on;
  if (on) await sendButtons(u.phone, "Lovely. Your tip arrives each morning, with a quick check-in on your customer chats. Ask me anything any time. 💚", [{ id: "m_menu", title: "Open menu" }]);
  else await sendButtons(u.phone, "Done, no more daily tips or check-ins. I'm still here whenever you need me.", [{ id: "tips_yes", title: "Tips back on" }, { id: "m_menu", title: "Open menu" }]);
}

async function setModeAndConfirm(u: WaUser, mode: "coach" | "quick") {
  await setMode(u.phone, mode); u.mode = mode;
  if (mode === "quick") await sendButtons(u.phone, "⚡ Quick mode on: short answers, no teaching notes.", [{ id: "mode_full", title: "Full coaching" }]);
  else await sendButtons(u.phone, "🎓 Full coaching is on: I'll explain the why and the questions behind every answer.", [{ id: "mode_quick", title: "Quick mode" }]);
}

async function showTracks(u: WaUser) {
  await sendList(u.phone, "What would you like to learn? Pick a track below, or just tell me a topic (for example: teach me objections).", "Choose a track",
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
  const msg = `*Drill ${(((u.drill_idx % drillCount) + drillCount) % drillCount) + 1} of ${drillCount} · ${d.focus}*\n\n${d.scenario}\n\nWhat would you ask or say next? Reply by typing it out or sending a voice note.`;
  await sendButtons(u.phone, msg, [{ id: "drill_skip", title: "Skip this one" }, { id: "act_done", title: "Stop drilling" }]);
  await remember(u.phone, "assistant", msg);
}

async function endActivity(u: WaUser) {
  await setActivity(u.phone, {});
  u.lesson_id = null; u.drill_id = null;
}

const VOICE_PRIVACY = "Voice notes are turned into text and the audio is not kept.";
const NO_VOICE = "Voice isn't switched on yet. For now, please type it out and I'll help right away. 💚";

/** Sends a spoken version of `text` as a voice note, within the distributor's daily allowance. Never throws. */
async function speak(u: WaUser, text: string, locale: string) {
  try {
    if (!voiceConfigured() || !text.trim()) return;
    if (!(await takeVoiceCredit(u.phone, dailyVoiceLimit()))) { console.log("voice daily limit reached"); return; }
    const ogg = await synthesize(text, locale);
    if (ogg) await sendVoice(u.phone, ogg);
  } catch (e) { console.error("speak error", e instanceof Error ? e.message : e); }
}

async function setVoiceAndConfirm(u: WaUser, on: boolean) {
  await setVoiceReply(u.phone, on); u.voice_reply = on;
  if (on) await sendButtons(u.phone, `🔊 Voice replies on: when you send me a voice note, I'll answer with a voice note too. ${VOICE_PRIVACY}`, [{ id: "voice_off", title: "Voice off" }]);
  else await sendButtons(u.phone, "🔇 Voice replies off. I'll still understand your voice notes and answer in text.", [{ id: "voice_on", title: "Voice on" }]);
}

async function voiceHelp(u: WaUser) {
  await sendButtons(u.phone, `🎤 *Voice*\nSend me a voice note and I will answer in text and, with voice replies on, in a voice note too. ${VOICE_PRIVACY}\n\nVoice replies are ${u.voice_reply ? "ON" : "OFF"}.${voiceConfigured() ? "" : "\n\n(Voice is not switched on yet, so for now please type.)"}`,
    [{ id: u.voice_reply ? "voice_off" : "voice_on", title: u.voice_reply ? "Voice off" : "Voice on" }, { id: "listen", title: "🔊 Listen" }]);
}

async function listenLast(u: WaUser, locale = "en-ZA") {
  if (!voiceConfigured()) { await sendText(u.phone, NO_VOICE); return; }
  const last = [...(await history(u.phone, 6))].reverse().find((t) => t.role === "assistant");
  if (!last) { await sendText(u.phone, "There is nothing to read yet. Ask me something first. 💚"); return; }
  await speak(u, last.content.replace(/\[product cards sent:[^\]]*\]/g, ""), locale);
}

/** Tap buttons to offer under a reply: teach, drill, listen, or stop a lesson. */
function followUpButtons(u: WaUser, reply: string, done: boolean): Btn[] {
  if (done || u.drill_id) return [];
  if (u.lesson_id) return [{ id: "act_done", title: "Stop lesson" }];
  const listen = voiceConfigured();
  if (u.mode !== "quick" && /Coach's note|\*Try it:\*/i.test(reply)) {
    return [{ id: "teach_this", title: "Teach me this" }, { id: "m_drill", title: "Drill me" }, listen ? { id: "listen", title: "🔊 Listen" } : { id: "mode_quick", title: "Quick mode" }];
  }
  return listen && reply.length > 600 ? [{ id: "listen", title: "🔊 Listen" }] : [];
}

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };

type AskOpts = { viaVoice?: boolean; locale?: string };
async function ask(u: WaUser, member: { id: string; name: string; upline?: string }, content: Block[], remembered: string, opts: AskOpts = {}) {
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
    const seq: ({ text: string } | { card: (typeof cards)[number] })[] = [...splitParts(text).map((t) => ({ text: t })), ...cards.map((card) => ({ card })), ...splitParts(after).map((t) => ({ text: t }))];
    const buttons = followUpButtons(u, reply, lessonDone || drillDone);
    for (let i = 0; i < seq.length; i++) {
      const it = seq[i];
      if ("card" in it) await sendImage(u.phone, imageUrl(it.card.code), it.card.caption);
      else if (i === seq.length - 1 && buttons.length) await sendTextWithButtons(u.phone, it.text, buttons);
      else await sendText(u.phone, it.text);
    }
    if (text || cards.length || after) await remember(u.phone, "assistant", [text, cards.length ? `[product cards sent: ${cards.map((c) => c.code).join(", ")}]` : "", after].filter(Boolean).join("\n"));
    if (cards.length && !u.lesson_id && !u.drill_id) await saveScenario(u.phone, remembered);
    if (opts.viaVoice && u.voice_reply) await speak(u, splitParts(text)[0] ?? splitParts(after)[0] ?? "", opts.locale ?? "en-ZA");
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

  const processText = async (text: string, viaVoice = false, locale = "en-ZA") => {
    const upper = text.trim().toUpperCase();
    if (["STOP", "UNSUBSCRIBE"].includes(upper)) { await setTipsAndConfirm(u, false); return; }
    if (upper === "START") { await setTipsAndConfirm(u, true); return; }
    if (["MENU", "?", "HELP", "HI", "HELLO"].includes(upper)) { await showMenu(u, streak); return; }
    if (upper === "SETTINGS") { await showSettings(u); return; }
    if (upper === "VOICE" || upper === "VOICE HELP") { await voiceHelp(u); return; }
    if (upper === "VOICE ON") { await setVoiceAndConfirm(u, true); return; }
    if (upper === "VOICE OFF") { await setVoiceAndConfirm(u, false); return; }
    if (upper === "LISTEN") { await listenLast(u, locale); return; }
    if (upper === "TIP" || upper === "SHOW ME") { await sendNextTip(u); return; }
    if (upper === "QUICK") { await setModeAndConfirm(u, "quick"); return; }
    if (upper === "FULL") { await setModeAndConfirm(u, "coach"); return; }
    if (upper === "DRILL") { await startDrill(u); return; }
    if (upper === "DONE" && (u.lesson_id || u.drill_id)) { await endActivity(u); await afterTraining(u); return; }
    if (upper === "TEACH" || upper.startsWith("TEACH ME") || upper.startsWith("TEACH ")) {
      const topic = text.replace(/^teach( me)?/i, "").replace(/^[\s:,-]+/, "").trim();
      const item = topic ? searchLesson(topic) : null;
      if (item) await startLesson(u, member!, item); else await showTracks(u);
      return;
    }
    if (!text) return;
    await ask(u, member!, [{ type: "text", text }], text, { viaVoice, locale });
    return;
  };
  if (m.kind === "button") {
    const id = m.actionId ?? "";
    if (id === "tips_yes") { await setTipsAndConfirm(u, true); return; }
    if (id === "tips_no") { await sendButtons(u.phone, "No problem. Tap below whenever you want a tip, or just ask me anything.", [{ id: "tip_today", title: "Send me a tip" }, { id: "m_menu", title: "Open menu" }]); return; }
    if (id === "m_menu") { await showMenu(u, streak); return; }
    if (id === "m_settings") { await showSettings(u); return; }
    if (id === "set_tips") { await setTipsAndConfirm(u, !u.tips_on); return; }
    if (id === "set_mode") { await setModeAndConfirm(u, u.mode === "quick" ? "coach" : "quick"); return; }
    if (id === "set_voice") { await setVoiceAndConfirm(u, !u.voice_reply); return; }
    if (id === "mode_quick") { await setModeAndConfirm(u, "quick"); return; }
    if (id === "mode_full") { await setModeAndConfirm(u, "coach"); return; }
    if (id === "voice_on") { await setVoiceAndConfirm(u, true); return; }
    if (id === "voice_off") { await setVoiceAndConfirm(u, false); return; }
    if (id === "m_voice") { await voiceHelp(u); return; }
    if (id === "listen") { await listenLast(u); return; }
    if (id === "drill_skip") { await bumpDrill(u.phone); u.drill_idx += 1; await startDrill(u); return; }
    if (id === "teach_this") {
      const recent = (await history(u.phone, 8)).filter((t) => t.role === "user").map((t) => t.content);
      const topic = u.last_scenario ?? recent[recent.length - 1] ?? "";
      const item = playbooksFor([topic, ...recent.slice(-2)])[0] ?? searchLesson(topic);
      if (item) await startLesson(u, member!, item); else await showTracks(u);
      return;
    }
    if (id === "tip_today" || id === "m_tip") { await sendNextTip(u); return; }
    if (id === "m_teach") { await showTracks(u); return; }
    if (id === "m_drill" || id === "drill_next") { await startDrill(u); return; }
    if (id === "act_done") { await endActivity(u); await afterTraining(u); return; }
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
    // A tap whose id we do not recognise (an old button, say) is never dropped: its title is treated as if the person had typed it.
    console.log("wa unknown tap id, using its title as text", { from: who, id: id.slice(0, 40) });
    if (m.text?.trim()) await processText(m.text.trim());
    return;
  }

  if (m.kind === "text") { await processText(text); return; }

  if (m.kind === "image" && m.mediaId) {
    const img = await fetchMedia(m.mediaId);
    if (!img || !/^image\/(jpeg|png|webp|gif)$/.test(img.mime)) { await sendText(u.phone, "I couldn't open that picture. Could you paste the text instead?"); return; }
    const note = m.text || "Here is a screenshot of my customer chat. Coach me on it.";
    await ask(u, member!, [{ type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg", data: img.data } }, { type: "text", text: note }], `[screenshot] ${note}`);
    return;
  }

  if (m.kind === "audio") {
    if (!voiceConfigured() || !m.mediaId) { await sendText(u.phone, NO_VOICE); return; }
    const media = await fetchMediaBuffer(m.mediaId, 2_000_000);
    if (!media) { await sendText(u.phone, "I couldn't open that voice note. Please try again, or type it out."); return; }
    const t = await transcribe(media.buf);
    if (!t.ok) {
      await sendText(u.phone, t.reason === "too_long" ? "That voice note is too long for me to handle. Please keep it under a minute, or type it out."
        : t.reason === "empty" ? "I couldn't make that out. Could you try again a little slower and closer to the phone, or type it out?" : TECH_ERROR);
      return;
    }
    await sendText(u.phone, `🎤 I heard: “${t.text}”`);
    await processText(t.text, true, t.locale);
    return;
  }
}
