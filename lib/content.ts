import curriculum from "@/data/curriculum.json";
import quizbanks from "@/data/quizbanks.json";
import samples from "@/data/samples.json";
import library from "@/data/library.json";
import framework from "@/data/framework.json";
import type { Week, Question, Sample, LibItem } from "./types";

export const WEEKS = curriculum as Week[];
export const LESSONS = WEEKS.flatMap((w) => w.lessons.map((l) => ({ ...l, week: w.n, weekTitle: w.title })));
export const findLesson = (id: string) => LESSONS.find((l) => l.id === id);
export const LIBRARY = library as LibItem[];
export const FRAMEWORK = framework as {
  levels: string[][]; rubric: [string, number, string][]; redflags: string[]; personas: string[][]; library: string[][];
};
const SAMPLES = samples as Record<string, Sample[]>;
export const ALL_SAMPLES: Sample[] = Object.values(SAMPLES).flat();

/** Full bank if one exists, otherwise the sample question(s) for that lesson, otherwise null. */
export function bankFor(id: string): Question[] | null {
  const b = (quizbanks as Record<string, Question[]>)[id];
  if (b) return b;
  const s = SAMPLES[id];
  return s ? s.map((x) => ({ m: 2, q: x.q, o: x.o, a: x.a, w: x.w })) : null;
}
