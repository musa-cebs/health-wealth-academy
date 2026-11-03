/** Product cards, mirroring Sweety: the model writes a short bridge plus one PRODUCT_CARD:[...] marker; each item becomes an image message with its caption. */
const IMAGE_BASE = "https://raw.githubusercontent.com/musa-cebs/health-sweets-images/main/";

// Same image library Sweety uses. PFT* is stored as PFT.png (Sweety's own PFT*.png link does not exist).
const FILES: Record<string, string> = {
  PWR_APRICOT: "PWR_APRICOT", PWR_LEMON: "PWR_LEMON", GTS: "GTS", SLD: "SLD", RLX: "RLX", NRM: "NRM", STP: "STP", GRW: "GRW",
  MLS: "MLS", ALT: "ALT", HRT: "HRT", ICE: "ICE", HPR: "HPR", LFT: "LFT", BTY: "BTY", BRN: "BRN", HPY: "HPY", AIR: "AIR", "PFT*": "PFT", PFT: "PFT",
};

export type Card = { code: string; caption: string };

/** Splits a model reply into the chat text and the cards. Unknown product codes are dropped. */
export function extractCards(reply: string): { text: string; cards: Card[] } {
  const m = reply.match(/^([\s\S]*?)PRODUCT_CARD:\s*(\[[\s\S]*\])\s*$/);
  if (!m) return { text: reply.replace(/PRODUCT_CARD:[\s\S]*$/, "").trim(), cards: [] };
  let cards: Card[] = [];
  try {
    const raw = JSON.parse(m[2]) as { code?: unknown; caption?: unknown }[];
    cards = raw
      .filter((c) => typeof c.code === "string" && typeof c.caption === "string" && FILES[c.code as string])
      .map((c) => ({ code: String(c.code), caption: String(c.caption).slice(0, 1000) }));
  } catch { /* malformed marker: fall back to text only */ }
  return { text: m[1].trim(), cards };
}

export const imageUrl = (code: string) => `${IMAGE_BASE}${encodeURIComponent(FILES[code])}.png`;
