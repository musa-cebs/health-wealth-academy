export type Lesson = { id: string; title: string; mins: number; outcomes: string[]; video: string[]; assess: string; practice: string | null };
export type Week = { n: number; title: string; thread: string; goal: string; badge: string; gate: string | null; lab: string; lessons: Lesson[] };
export type Question = { m: number; q: string; o: string[]; a: number; w: string };
export type Sample = { q: string; o: string[]; a: number; w: string };
export type LibItem = { id: number; type: string; title: string; tags: string[]; body: string; status?: string; flag?: string | null };
export type Msg = { role: "user" | "assistant"; content: string };
