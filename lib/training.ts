import data from "@/data/training.json";

export type Track = { id: string; name: string; short: string; desc: string };
export type Module = { id: string; track: string; title: string; short: string; keywords: string[]; summary: string; steps: string[]; script: string; practice: string };
export type Playbook = { id: string; track: string; title: string; short: string; keywords: string[]; products: string; questions: string[][]; redFlags: string; mistakes: string[]; drills: string[] };
export type Item = Module | Playbook;
export type Drill = { id: string; focus: string; scenario: string; ref: string };

const tracks = data.tracks as Track[];
const modules = data.modules as Module[];
const playbooks = data.playbooks as Playbook[];

export const allTracks = () => tracks;
export const trackById = (id: string) => tracks.find((t) => t.id === id);
export const itemsInTrack = (track: string): Item[] => (track === "diagnosis" ? playbooks : modules.filter((m) => m.track === track));
export const isPlaybook = (i: Item): i is Playbook => "questions" in i;

/** Lesson ids: module ids as they are, playbook ids prefixed with "p:". */
export const lessonId = (i: Item) => (isPlaybook(i) ? `p:${i.id}` : i.id);
export function getLesson(id: string | null | undefined): Item | null {
  if (!id) return null;
  return id.startsWith("p:") ? playbooks.find((p) => p.id === id.slice(2)) ?? null : modules.find((m) => m.id === id) ?? null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s*]/g, " ").replace(/\s+/g, " ").trim();
/** Whole-word match (so "join" never matches "joint"), allowing a simple plural. */
const hasWord = (padded: string, k: string) => padded.includes(` ${k} `) || padded.includes(` ${k}s `) || padded.includes(` ${k}es `);
function score(text: string, i: Item): number {
  const padded = ` ${norm(text)} `;
  let s = 0;
  for (const k of i.keywords) { const nk = norm(k); if (nk && hasWord(padded, nk)) s += nk.includes(" ") ? 3 : 2; }
  if (hasWord(padded, norm(i.short))) s += 4;
  return s;
}

/** Best matching lesson for a free-text topic, or null if nothing fits. */
export function searchLesson(query: string): Item | null {
  let best: Item | null = null, top = 0;
  for (const i of [...modules, ...playbooks]) { const s = score(query, i); if (s > top) { top = s; best = i; } }
  return top >= 2 ? best : null;
}

/** Up to two diagnostic playbooks that match what the distributor has been talking about. */
export function playbooksFor(texts: string[]): Playbook[] {
  const joined = texts.join(" ");
  return playbooks.map((p) => ({ p, s: score(joined, p) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.p);
}

/** Drills cycle through every module practice scenario and every playbook scenario. */
const drills: Drill[] = [
  ...playbooks.flatMap((p) => p.drills.map((d, n) => ({ id: `p:${p.id}:${n}`, focus: `Diagnosis: ${p.short}`, scenario: d, ref: `p:${p.id}` }))),
  ...modules.map((m) => ({ id: m.id, focus: m.short, scenario: m.practice, ref: m.id })),
];
export const drillCount = drills.length;
export const drillAt = (idx: number): Drill => drills[((idx % drills.length) + drills.length) % drills.length];
export const getDrill = (id: string | null | undefined): Drill | null => (id ? drills.find((d) => d.id === id) ?? null : null);

function describe(i: Item): string {
  if (isPlaybook(i)) {
    return [
      `DIAGNOSTIC PLAYBOOK: ${i.title}`,
      `Typical product fit: ${i.products}`,
      "Questions to teach, each with its purpose:",
      ...i.questions.map(([q, why], n) => `${n + 1}. ${q} (purpose: ${why})`),
      `Red flags (doctor first): ${i.redFlags}`,
      `Common mistakes: ${i.mistakes.join(" ")}`,
    ].join("\n");
  }
  return [`LESSON: ${i.title}`, `Key idea: ${i.summary}`, "Steps:", ...i.steps.map((s, n) => `${n + 1}. ${s}`), `Example words: ${i.script}`, `Practice scenario: ${i.practice}`].join("\n");
}

/** The dynamic part of the system prompt: mode, active lesson or drill, and any matching diagnostic playbooks. */
export function trainingContext(o: { mode: string; lessonId?: string | null; drillId?: string | null; recentTexts: string[] }): string {
  const parts: string[] = ["", "ACTIVE CONTEXT FOR THIS REPLY (set by the system, not by the user):"];
  parts.push(o.mode === "quick"
    ? "MODE: QUICK. The distributor wants short answers. Skip the *Coach's note* and the purposes in brackets, keep it brief, and mention they can switch the teaching notes back on from the menu (Settings)."
    : "MODE: COACH. Use the full teaching layer described above.");
  const lesson = getLesson(o.lessonId);
  const drill = getDrill(o.drillId);
  if (lesson) {
    parts.push("ACTIVE LESSON: the distributor is in a lesson. If this is the start, teach it as three short messages separated by lines containing only ---: (1) the hook and key idea, (2) the steps with the example words, (3) the practice scenario for them to answer. If they are answering the practice scenario, give feedback: one thing done well, one improvement, a short model answer, and check the wording is compliant. Then output LESSON_DONE on its own line. If their message is clearly unrelated to the lesson, answer it helpfully first and invite them to continue the lesson or type DONE. Use only the content below and the product facts above; never invent APLGO details.");
    parts.push(describe(lesson));
  } else if (drill) {
    const ref = getLesson(drill.ref);
    parts.push(`ACTIVE DRILL: the distributor was given this scenario and has now answered it. Scenario: ${drill.scenario}`);
    parts.push("Give feedback in under 700 characters: two things done well, one thing to improve, and a short model answer. Check the wording is compliant and the safety check was handled. Then output DRILL_DONE on its own line. Do not start a new scenario yourself.");
    if (ref) parts.push(describe(ref));
  } else {
    const pbs = playbooksFor(o.recentTexts);
    if (pbs.length) {
      parts.push("DIAGNOSTIC PLAYBOOKS that match this conversation. Build the *Ask your customer* questions from these and keep each question's purpose in brackets:");
      for (const p of pbs) parts.push(describe(p));
    }
  }
  return parts.join("\n");
}
