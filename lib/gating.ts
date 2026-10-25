import { LESSONS } from "./content";

/** Lessons open in order. Forward is locked until the previous lesson is complete; backward is always open. */
export function prerequisite(id: string): { id: string; title: string } | null {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i > 0 ? { id: LESSONS[i - 1].id, title: LESSONS[i - 1].title } : null;
}
export function isUnlocked(id: string, done: Record<string, unknown>, preview: boolean): boolean {
  if (preview) return true;
  const p = prerequisite(id);
  return !p || Boolean(done[p.id]);
}
