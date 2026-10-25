import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = { sub: string; name: string; upline?: string; role: "distributor" | "leader"; exp: number };
export const COOKIE = "hw_session";
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();
const safeEq = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Auth is only enforced once SSO_SECRET is set, so the app still runs for local development and first review. */
export const authEnabled = () => !!process.env.SSO_SECRET;
const sessionSecret = () => process.env.SESSION_SECRET || process.env.SSO_SECRET || "";

export function signSession(s: Omit<Session, "exp">, days = 7): string {
  const payload = b64(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + days * 86400 }));
  return `${payload}.${b64(mac(payload, sessionSecret()))}`;
}
export function readSession(cookie: string | undefined): Session | null {
  if (!cookie || !sessionSecret()) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig || !safeEq(Buffer.from(sig, "base64url"), mac(payload, sessionSecret()))) return null;
  try { const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session; return s.exp > Date.now() / 1000 ? s : null; } catch { return null; }
}

/** Verifies the short-lived HS256 token that Vendor AI issues when a distributor clicks "Training". Claims: sub (member id), name, upline?, role?, exp (max 10 minutes ahead). */
export function verifySsoToken(token: string): Omit<Session, "exp"> | null {
  const secret = process.env.SSO_SECRET; if (!secret) return null;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;
  try {
    if (JSON.parse(Buffer.from(h, "base64url").toString()).alg !== "HS256") return null;
    if (!safeEq(Buffer.from(sig, "base64url"), mac(`${h}.${p}`, secret))) return null;
    const c = JSON.parse(Buffer.from(p, "base64url").toString());
    const now = Date.now() / 1000;
    if (!c.sub || typeof c.exp !== "number" || c.exp < now || c.exp > now + 600) return null;
    return { sub: String(c.sub), name: String(c.name ?? ""), upline: c.upline ? String(c.upline) : undefined, role: c.role === "leader" ? "leader" : "distributor" };
  } catch { return null; }
}
