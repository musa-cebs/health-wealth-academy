import type { Member } from "@/lib/pocket-coach-prompt";

/**
 * Decides whether a WhatsApp number belongs to a registered distributor.
 * 1) WA_ALLOWLIST (comma-separated 27… numbers) for pilots.
 * 2) VENDORAI_MEMBER_URL: Vendor AI looks the number up in the member list and returns
 *    { member_id, name, upline, active } (secured with ACADEMY_API_SECRET).
 */
export async function verifyMember(phone: string): Promise<Member | null> {
  const allow = (process.env.WA_ALLOWLIST ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.includes(phone)) return { id: "pilot", name: "there" };
  const url = process.env.VENDORAI_MEMBER_URL;
  const secret = process.env.ACADEMY_API_SECRET;
  if (!url || !secret) return null;
  try {
    const r = await fetch(`${url}?phone=${encodeURIComponent(phone)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" });
    if (!r.ok) return null;
    const m = (await r.json()) as { member_id?: string; name?: string; upline?: string; active?: boolean };
    if (!m.member_id || m.active === false) return null;
    return { id: m.member_id, name: m.name || "there", upline: m.upline };
  } catch { return null; }
}
