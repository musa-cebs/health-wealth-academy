import { db } from "@/lib/db";

const SCHEMA = `
create table if not exists wa_users (phone text primary key, member_id text not null, name text not null, upline text not null default '', tips_on boolean not null default false, tip_day int not null default 0, streak int not null default 0, last_active date, created_at timestamptz not null default now());
create table if not exists wa_msgs (msg_id text primary key, created_at timestamptz not null default now());
create table if not exists wa_history (id bigserial primary key, phone text not null, role text not null, content text not null, created_at timestamptz not null default now());
create index if not exists wa_history_phone_idx on wa_history (phone, id desc);
alter table wa_users add column if not exists mode text not null default 'coach';
alter table wa_users add column if not exists lesson_id text;
alter table wa_users add column if not exists drill_id text;
alter table wa_users add column if not exists drill_idx int not null default 0;
alter table wa_users add column if not exists last_scenario text;
alter table wa_users add column if not exists scenario_at timestamptz;
alter table wa_users add column if not exists checkin_at timestamptz;
alter table wa_users add column if not exists voice_reply boolean not null default true;
alter table wa_users add column if not exists voice_day text;
alter table wa_users add column if not exists voice_count int not null default 0;`;
let ready: Promise<unknown> | null = null;
/** Database handle with the Pocket Coach tables created on first use (no manual SQL step needed). */
async function conn() {
  const sql = db();
  if (!sql) return null;
  await (ready ??= sql.unsafe(SCHEMA).catch((e) => { ready = null; throw e; }));
  return sql;
}

export type WaUser = {
  phone: string; member_id: string; name: string; upline: string; tips_on: boolean; tip_day: number; streak: number; last_active: string | null;
  mode: string; lesson_id: string | null; drill_id: string | null; drill_idx: number; last_scenario: string | null; scenario_at: string | null; checkin_at: string | null;
  voice_reply: boolean; voice_day: string | null; voice_count: number;
};
const COLS = `phone, member_id, name, upline, tips_on, tip_day, streak, last_active::text, mode, lesson_id, drill_id, drill_idx, last_scenario, scenario_at::text, checkin_at::text, voice_reply, voice_day, voice_count`;
type Turn = { role: "user" | "assistant"; content: string };

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

// Without DATABASE_URL the store lives in memory: fine for local testing, but it is lost between serverless invocations.
const mem = { users: new Map<string, WaUser>(), seen: new Set<string>(), hist: new Map<string, Turn[]>() };

/** True the first time a WhatsApp message id is seen, so Meta's retries are ignored. */
export async function firstSeen(msgId: string): Promise<boolean> {
  const sql = await conn();
  if (!sql) { if (mem.seen.has(msgId)) return false; mem.seen.add(msgId); return true; }
  const r = await sql`insert into wa_msgs (msg_id) values (${msgId}) on conflict do nothing returning msg_id`;
  return r.length > 0;
}

export async function getUser(phone: string): Promise<WaUser | null> {
  const sql = await conn();
  if (!sql) return mem.users.get(phone) ?? null;
  const r = await sql.unsafe(`select ${COLS} from wa_users where phone = $1`, [phone]);
  return ((r[0] as unknown) as WaUser) ?? null;
}

export async function saveUser(u: Pick<WaUser, "phone" | "member_id" | "name" | "upline">): Promise<WaUser> {
  const sql = await conn();
  if (!sql) { const n: WaUser = { tips_on: false, tip_day: 0, streak: 0, last_active: null, mode: "coach", lesson_id: null, drill_id: null, drill_idx: 0, last_scenario: null, scenario_at: null, checkin_at: null, voice_reply: true, voice_day: null, voice_count: 0, ...u }; mem.users.set(u.phone, n); return n; }
  await sql`insert into wa_users (phone, member_id, name, upline) values (${u.phone}, ${u.member_id}, ${u.name}, ${u.upline})
            on conflict (phone) do update set member_id = excluded.member_id, name = excluded.name, upline = excluded.upline`;
  return (await getUser(u.phone))!;
}

export async function setTips(phone: string, on: boolean) {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.tips_on = on; return; }
  await sql`update wa_users set tips_on = ${on} where phone = ${phone}`;
}

export async function setTipDay(phone: string, day: number) {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.tip_day = day; return; }
  await sql`update wa_users set tip_day = ${day} where phone = ${phone}`;
}

/** Records activity and returns the new streak (consecutive days using the coach). */
export async function touch(u: WaUser): Promise<number> {
  if (u.last_active === today()) return u.streak;
  const streak = u.last_active === yesterday() ? u.streak + 1 : 1;
  const sql = await conn();
  if (!sql) { const m = mem.users.get(u.phone); if (m) { m.streak = streak; m.last_active = today(); } }
  else await sql`update wa_users set streak = ${streak}, last_active = ${today()} where phone = ${u.phone}`;
  u.streak = streak; u.last_active = today();
  return streak;
}

export async function history(phone: string, n = 12): Promise<Turn[]> {
  const sql = await conn();
  if (!sql) return (mem.hist.get(phone) ?? []).slice(-n);
  const r = await sql`select role, content from (select role, content, id from wa_history where phone = ${phone} order by id desc limit ${n}) t order by id`;
  return r as unknown as Turn[];
}

export async function remember(phone: string, role: Turn["role"], content: string) {
  const sql = await conn();
  if (!sql) { const h = mem.hist.get(phone) ?? []; h.push({ role, content }); mem.hist.set(phone, h.slice(-40)); return; }
  await sql`insert into wa_history (phone, role, content) values (${phone}, ${role}, ${content.slice(0, 4000)})`;
}

export async function tipSubscribers(): Promise<WaUser[]> {
  const sql = await conn();
  if (!sql) return [...mem.users.values()].filter((u) => u.tips_on);
  return (await sql.unsafe(`select ${COLS} from wa_users where tips_on = true`)) as unknown as WaUser[];
}

// ---- Training layer state -------------------------------------------------

export async function setMode(phone: string, mode: "coach" | "quick") {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.mode = mode; return; }
  await sql`update wa_users set mode = ${mode} where phone = ${phone}`;
}

/** Starts or ends a lesson or a drill (only one is active at a time). */
export async function setActivity(phone: string, a: { lesson?: string | null; drill?: string | null }) {
  const lesson = a.lesson ?? null, drill = a.drill ?? null;
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) { u.lesson_id = lesson; u.drill_id = drill; } return; }
  await sql`update wa_users set lesson_id = ${lesson}, drill_id = ${drill} where phone = ${phone}`;
}

export async function bumpDrill(phone: string) {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.drill_idx += 1; return; }
  await sql`update wa_users set drill_idx = drill_idx + 1 where phone = ${phone}`;
}

/** Remembers the customer situation the distributor last asked about, for the next-morning check-in. */
export async function saveScenario(phone: string, text: string) {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) { u.last_scenario = snippet; u.scenario_at = new Date().toISOString(); } return; }
  await sql`update wa_users set last_scenario = ${snippet}, scenario_at = now() where phone = ${phone}`;
}

/** Distributors asked about a customer between 2 and 22 hours ago (WhatsApp's 24-hour window is still open) and not yet checked in on. */
export async function pendingCheckins(): Promise<WaUser[]> {
  const sql = await conn();
  const due = (u: WaUser) => {
    if (!u.tips_on || !u.last_scenario || !u.scenario_at) return false;
    const age = Date.now() - new Date(u.scenario_at).getTime();
    return age >= 2 * 3600_000 && age <= 22 * 3600_000 && (!u.checkin_at || new Date(u.checkin_at) < new Date(u.scenario_at));
  };
  if (!sql) return [...mem.users.values()].filter(due);
  const r = (await sql.unsafe(`select ${COLS} from wa_users where tips_on = true and last_scenario is not null and scenario_at between now() - interval '22 hours' and now() - interval '2 hours' and (checkin_at is null or checkin_at < scenario_at)`)) as unknown as WaUser[];
  return r;
}

export async function markCheckin(phone: string) {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.checkin_at = new Date().toISOString(); return; }
  await sql`update wa_users set checkin_at = now() where phone = ${phone}`;
}

// ---- Voice -----------------------------------------------------------------

export async function setVoiceReply(phone: string, on: boolean) {
  const sql = await conn();
  if (!sql) { const u = mem.users.get(phone); if (u) u.voice_reply = on; return; }
  await sql`update wa_users set voice_reply = ${on} where phone = ${phone}`;
}

/** Counts one voice reply against today's allowance. Returns true while the distributor is within their daily limit. */
export async function takeVoiceCredit(phone: string, limit: number): Promise<boolean> {
  const day = today();
  const sql = await conn();
  if (!sql) {
    const u = mem.users.get(phone); if (!u) return false;
    u.voice_count = u.voice_day === day ? u.voice_count + 1 : 1; u.voice_day = day;
    return u.voice_count <= limit;
  }
  const r = await sql`update wa_users set voice_count = case when voice_day = ${day} then voice_count + 1 else 1 end, voice_day = ${day} where phone = ${phone} returning voice_count`;
  return Number(r[0]?.voice_count ?? limit + 1) <= limit;
}
