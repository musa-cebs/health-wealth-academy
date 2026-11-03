import tips from "@/data/tips.json";

export type Tip = { day: number; weekday: string; theme: string; title: string; tip: string; say_it: string; challenge: { customer_says: string; pointers: string[] } | null };
const all = tips as unknown as Tip[];

/** Tip for a 1-based day number, cycling through the 30-day bank. */
export const tipFor = (day: number): Tip => all[(((day - 1) % all.length) + all.length) % all.length];
export const nextDay = (day: number) => (day % all.length) + 1;

export const tipText = (t: Tip) => `*Day ${t.day} · ${t.theme}*\n*${t.title}*\n\n${t.tip}`;
export const sayItText = (t: Tip) => `*Send this:*\n${t.say_it}`;
/** What the coach is told when the distributor taps Practise on a tip. */
export const practiseSeed = (t: Tip) =>
  t.challenge
    ? `Let me practise. Play the customer. Open with the customer saying: "${t.challenge.customer_says}"`
    : `Let me practise: ${t.title}. Play a realistic customer for a short back-and-forth.`;
