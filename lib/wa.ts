import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const cfg = () => ({ id: process.env.WA_PHONE_NUMBER_ID, token: process.env.WA_TOKEN });

export type Incoming = {
  id: string;
  from: string;
  kind: "text" | "button" | "image" | "audio" | "other";
  text?: string;
  actionId?: string;
  mediaId?: string;
};

/** True when the X-Hub-Signature-256 header matches the raw body, signed with the Meta app secret. */
export function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = createHmac("sha256", secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Pulls the customer-visible messages out of a Meta webhook payload (statuses are ignored). */
export function parseIncoming(payload: any): Incoming[] {
  const out: Incoming[] = [];
  for (const e of payload?.entry ?? []) for (const c of e?.changes ?? []) {
    for (const m of c?.value?.messages ?? []) {
      const base = { id: String(m.id), from: String(m.from) };
      if (m.type === "text") out.push({ ...base, kind: "text", text: m.text?.body ?? "" });
      else if (m.type === "interactive") {
        const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
        if (r) out.push({ ...base, kind: "button", actionId: r.id, text: r.title });
      } else if (m.type === "button") out.push({ ...base, kind: "button", actionId: m.button?.payload, text: m.button?.text });
      else if (m.type === "image") out.push({ ...base, kind: "image", mediaId: m.image?.id, text: m.image?.caption });
      else if (m.type === "audio") out.push({ ...base, kind: "audio", mediaId: m.audio?.id });
      else out.push({ ...base, kind: "other" });
    }
  }
  return out;
}

async function post(body: object) {
  const { id, token } = cfg();
  if (!id || !token) { console.error("WhatsApp is not configured: set WA_PHONE_NUMBER_ID and WA_TOKEN."); return; }
  const r = await fetch(`${GRAPH}/${id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!r.ok) console.error("WhatsApp send failed", r.status, (await r.text()).slice(0, 300));
  else console.log("wa sent", { status: r.status });
}

export const sendImage = (to: string, link: string, caption: string) =>
  post({ to, type: "image", image: { link, caption: caption.slice(0, 1024) } });

export const sendText = (to: string, body: string) => post({ to, type: "text", text: { body: body.slice(0, 4000) } });

/** Up to three tap buttons; titles are cut to WhatsApp's 20-character limit. */
export const sendButtons = (to: string, body: string, buttons: { id: string; title: string }[]) =>
  post({
    to, type: "interactive",
    interactive: {
      type: "button", body: { text: body.slice(0, 1000) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });

export const sendList = (to: string, body: string, button: string, rows: { id: string; title: string; description?: string }[]) =>
  post({
    to, type: "interactive",
    interactive: {
      type: "list", body: { text: body.slice(0, 1000) },
      action: { button: button.slice(0, 20), sections: [{ title: "Pocket Coach", rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: r.description?.slice(0, 72) })) }] },
    },
  });

/** Approved template, used to open the 24-hour window (the daily tip nudge). */
export const sendTemplate = (to: string, name: string, params: string[], quickReplyPayload?: string) =>
  post({
    to, type: "template",
    template: {
      name, language: { code: "en" },
      components: [
        { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
        ...(quickReplyPayload ? [{ type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: quickReplyPayload }] }] : []),
      ],
    },
  });

export const markRead = (messageId: string) => post({ status: "read", message_id: messageId });

/** Downloads an image the distributor sent (for screenshots of customer chats). */
export async function fetchMedia(mediaId: string): Promise<{ mime: string; data: string } | null> {
  const { token } = cfg();
  if (!token) return null;
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) return null;
  const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
  const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!file.ok) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 4_500_000) return null;
  return { mime: mime_type, data: buf.toString("base64") };
}
