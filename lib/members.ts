import type { Member } from "@/lib/pocket-coach-prompt";

/**
 * Decides whether a WhatsApp number belongs to a registered distributor.
 * 1) WA_ALLOWLIST (comma-separated 27… numbers) for pilots.
 * 2) VENDORAI_MEMBER_URL: Vendor AI looks the number up in the member list and returns
 *    { member_id, name, upline, active } (secured with ACADEMY_API_SECRET).
 */
export type Access = { ok: true; member: Member } | { ok: false; reason: "not_member" | "error" };

export async function verifyMember(phone: string): Promise<Access> {
  const allow = (process.env.WA_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.includes(phone)) return { ok: true, member: { id: "pilot", name: "there" } };
  const url = process.env.VENDORAI_MEMBER_URL;
  const secret = process.env.ACADEMY_API_SECRET;
  if (!url || !secret) return { ok: false, reason: "not_member" };
  try {
    const r = await fetch(`${url}?phone=${encodeURIComponent(phone)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
    if (r.status === 404) return { ok: false, reason: "not_member" };
    if (!r.ok) { console.error("member lookup failed", r.status); return { ok: false, reason: "error" }; }
    const m = (await r.json()) as { member_id?: string; name?: string; upline?: string; active?: boolean };
    if (!m.member_id || m.active === false) return { ok: false, reason: "not_member" };
    return { ok: true, member: { id: m.member_id, name: m.name || "there", upline: m.upline } };
  } catch (e) {
    console.error("member lookup error", e instanceof Error ? e.message : e);
    return { ok: false, reason: "error" };
  }
}
