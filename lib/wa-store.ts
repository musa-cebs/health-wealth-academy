import { db } from "@/lib/db";

export type WaUser = { phone: string; member_id: string; name: string; upline: string; tips_on: boolean; tip_day: number; streak: number; last_active: string | null };
type Turn = { role: "user" | "assistant"; content: string };

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

// Without DATABASE_URL the store lives in memory: fine for local testing, but it is lost between serverless invocations.
const mem = { users: new Map<string, WaUser>(), seen: new Set<string>(), hist: new Map<string, Turn[]>() };

/** True the first time a WhatsApp message id is seen, so Meta's retries are ignored. */
export async function firstSeen(msgId: string): Promise<boolean> {
  const sql = db();
  if (!sql) { if (mem.seen.has(msgId)) return false; mem.seen.add(msgId); return true; }
  const r = await sql`insert into wa_msgs (msg_id) values (${msgId}) on conflict do nothing returning msg_id`;
  return r.length > 0;
}

export async function getUser(phone: string): Promise<WaUser | null> {
  const sql = db();
  if (!sql) return mem.users.get(phone) ?? null;
  const r = await sql`select phone, member_id, name, upline, tips_on, tip_day, streak, last_active::text from wa_users where phone = ${phone}`;
  return (r[0] as WaUser) ?? null;
}

export async function saveUser(u: Pick<WaUser, "phone" | "member_id" | "name" | "upline">): Promise<WaUser> {
  const sql = db();
  if (!sql) { const n: WaUser = { tips_on: false, tip_day: 0, streak: 0, last_active: null, ...u }; mem.users.set(u.phone, n); return n; }
  await sql`insert into wa_users (phone, member_id, name, upline) values (${u.phone}, ${u.member_id}, ${u.name}, ${u.upline})
            on conflict (phone) do update set member_id = excluded.member_id, name = excluded.name, upline = excluded.upline`;
  return (await getUser(u.phone))!;
}

export async function setTips(phone: string, on: boolean) {
  const sql = db();
  if (!sql) { const u = mem.users.get(phone); if (u) u.tips_on = on; return; }
  await sql`update wa_users set tips_on = ${on} where phone = ${phone}`;
}

export async function setTipDay(phone: string, day: number) {
  const sql = db();
  if (!sql) { const u = mem.users.get(phone); if (u) u.tip_day = day; return; }
  await sql`update wa_users set tip_day = ${day} where phone = ${phone}`;
}

/** Records activity and returns the new streak (consecutive days using the coach). */
export async function touch(u: WaUser): Promise<number> {
  if (u.last_active === today()) return u.streak;
  const streak = u.last_active === yesterday() ? u.streak + 1 : 1;
  const sql = db();
  if (!sql) { const m = mem.users.get(u.phone); if (m) { m.streak = streak; m.last_active = today(); } }
  else await sql`update wa_users set streak = ${streak}, last_active = ${today()} where phone = ${u.phone}`;
  u.streak = streak; u.last_active = today();
  return streak;
}

export async function history(phone: string, n = 12): Promise<Turn[]> {
  const sql = db();
  if (!sql) return (mem.hist.get(phone) ?? []).slice(-n);
  const r = await sql`select role, content from (select role, content, id from wa_history where phone = ${phone} order by id desc limit ${n}) t order by id`;
  return r as unknown as Turn[];
}

export async function remember(phone: string, role: Turn["role"], content: string) {
  const sql = db();
  if (!sql) { const h = mem.hist.get(phone) ?? []; h.push({ role, content }); mem.hist.set(phone, h.slice(-40)); return; }
  await sql`insert into wa_history (phone, role, content) values (${phone}, ${role}, ${content.slice(0, 4000)})`;
}

export async function tipSubscribers(): Promise<WaUser[]> {
  const sql = db();
  if (!sql) return [...mem.users.values()].filter((u) => u.tips_on);
  return (await sql`select phone, member_id, name, upline, tips_on, tip_day, streak, last_active::text from wa_users where tips_on = true`) as unknown as WaUser[];
}
