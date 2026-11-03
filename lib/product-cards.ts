/** Product cards, mirroring Sweety: the model writes a short bridge plus one PRODUCT_CARD:[...] marker; each item becomes an image message with its caption. */
const IMAGE_BASE = "https://raw.githubusercontent.com/musa-cebs/health-sweets-images/main/";

// Same image library Sweety uses. PFT* is stored as PFT.png (Sweety's own PFT*.png link does not exist).
const FILES: Record<string, string> = {
  PWR_APRICOT: "PWR_APRICOT", PWR_LEMON: "PWR_LEMON", GTS: "GTS", SLD: "SLD", RLX: "RLX", NRM: "NRM", STP: "STP", GRW: "GRW",
  MLS: "MLS", ALT: "ALT", HRT: "HRT", ICE: "ICE", HPR: "HPR", LFT: "LFT", BTY: "BTY", BRN: "BRN", HPY: "HPY", AIR: "AIR", "PFT*": "PFT", PFT: "PFT",
};

export type Card = { code: string; caption: string };

/** Finds the end of the JSON array that starts at `start`, ignoring brackets inside strings. Returns -1 if it never closes (truncated reply). */
function arrayEnd(t: string, start: number): number {
  let depth = 0, inStr = false;
  for (let k = start; k < t.length; k++) {
    const c = t[k];
    if (inStr) { if (c === "\\") k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return k;
  }
  return -1;
}

/** Splits a model reply into text before the cards, the cards, and text after them. Unknown product codes are dropped. */
export function extractCards(reply: string): { text: string; cards: Card[]; after: string } {
  const idx = reply.indexOf("PRODUCT_CARD:");
  if (idx < 0) return { text: reply.trim(), cards: [], after: "" };
  const before = reply.slice(0, idx).trim();
  const start = reply.indexOf("[", idx);
  const end = start < 0 ? -1 : arrayEnd(reply, start);
  if (end < 0) return { text: before, cards: [], after: "" }; // truncated marker: drop it
  let cards: Card[] = [];
  try {
    const raw = JSON.parse(reply.slice(start, end + 1)) as { code?: unknown; caption?: unknown }[];
    cards = raw
      .filter((c) => typeof c.code === "string" && typeof c.caption === "string" && FILES[c.code as string])
      .map((c) => ({ code: String(c.code), caption: String(c.caption).slice(0, 1000) }));
  } catch { /* malformed marker: text only */ }
  return { text: before, cards, after: reply.slice(end + 1).trim() };
}

/** Splits a reply into separate WhatsApp messages at lines containing only ---. */
export const splitParts = (t: string) => t.split(/\n\s*-{3,}\s*\n/).map((x) => x.trim()).filter(Boolean).slice(0, 4);

/** If the model hit its length limit, cut back to the last complete sentence or line so nothing is sent half-finished. */
export function trimToComplete(t: string): string {
  const cut = Math.max(t.lastIndexOf("\n"), t.search(/[.!?…][^.!?…]*$/) + 1);
  return cut > 0 ? t.slice(0, cut).trim() : t.trim();
}

export const imageUrl = (code: string) => `${IMAGE_BASE}${encodeURIComponent(FILES[code])}.png`;
