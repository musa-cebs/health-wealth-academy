import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { WEEKS, LIBRARY, FRAMEWORK } from "./content";
import products from "@/data/products.json";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}

/** Minimal guard: optional access code plus a small per-IP rate limit. Replace with real auth before launch. */
const hits = new Map<string, number[]>();
export function guard(req: NextRequest): NextResponse | null {
  const code = process.env.ACADEMY_ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) return NextResponse.json({ error: "Access code required." }, { status: 401 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 20) return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  recent.push(now); hits.set(ip, recent);
  return null;
}

const PRODUCT_TEXT = products
  .map((p) => `${p.code} (${p.name}), ${p.tier} R${p.price}, take ${p.usage}. Ingredients: ${p.ingredients}. Supports: ${p.supports}.`)
  .join("\n");
const DAILY = products.filter((p) => p.usage === "daily").map((p) => p.code).join(", ");
const AS_NEEDED = products.filter((p) => p.usage !== "daily").map((p) => p.code).join(", ");

/** Facts shared with the customer assistant (Sweety). Keep in sync with the Make system prompt. Draft wording pending compliance approval. */
export const FACTS = `PRODUCTS (code, name, tier and price, usage, ingredients, what it supports):
${PRODUCT_TEXT}
Tiers: Standard R860, Premium R1350, Elite R1850, Elite Special R1620.
DELIVERY: always charged. R109.20 for Johannesburg, Pretoria, Cape Town, Durban, Gqeberha, Bloemfontein; R119.70 elsewhere. Collection from offices in Johannesburg, Durban, Empangeni, Pietermaritzburg (weekdays 9-5, Saturday 9-1).
USAGE: dissolve one lozenge in the mouth. Take daily: ${DAILY}. Take as needed: ${AS_NEEDED}. More than recommended does not work faster. Full benefit builds over 3 to 6 months of consistent use.
EVIDENCE: no large-scale clinical trials on the finished products; several plant ingredients have their own published research. Never say studies prove the product works. Do not state regulatory approval or registration unless wording has been approved.
SAFETY: use 'supports, maintains, helps', never 'cures, treats, prevents'. Never diagnose. Always ask about chronic or prescription medication. Never suggest stopping or replacing medication. Suggest a doctor when symptoms sound serious.
CLOSER (care-first): Clarify, Label, Overview (what they tried + medication), Sell the vacation (short bridge, honest), Explain away concerns, Reinforce (one genuine line, then ask delivery or collection).
CULTURE: Health & Wealth is not a hit-and-run but a health journey. We love and care for people, including after-sales care beyond products.`;

export function curriculumDigest() {
  return WEEKS.map((w) => `Week ${w.n} ${w.title}: ` + w.lessons.map((l) => `L${l.id} ${l.title}`).join("; ")).join("\n");
}
export function libraryDigest() {
  return LIBRARY.filter((i) => !i.type.startsWith("Testimonial")).map((i) => `${i.title}: ${i.body}`).join("\n");
}
export const RUBRIC_TEXT = FRAMEWORK.rubric.map(([n, m, d]) => `${n} (${m}): ${d}`).join("\n");
export const REDFLAG_TEXT = FRAMEWORK.redflags.map((r) => "- " + r).join("\n");
