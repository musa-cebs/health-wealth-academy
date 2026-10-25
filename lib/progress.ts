"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Progress = { done: Record<string, { score: number }>; drill: number };
const KEY = "hw-academy-v1";
const empty: Progress = { done: {}, drill: 0 };

/** Uses the server (Postgres, per signed-in member) when available, and falls back to this browser's storage otherwise. */
export function useProgress() {
  const [p, setP] = useState<Progress>(empty);
  const server = useRef(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/progress");
        if (r.ok) { const j = await r.json(); server.current = true; setP({ done: j.done, drill: j.drill }); return; }
      } catch {}
      try { const r = localStorage.getItem(KEY); if (r) setP({ ...empty, ...JSON.parse(r) }); } catch {}
    })();
  }, []);
  const update = useCallback((fn: (p: Progress) => Progress) => {
    setP((cur) => {
      const n = fn(cur);
      if (server.current) {
        for (const [id, v] of Object.entries(n.done)) if (cur.done[id]?.score !== v.score)
          fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "lesson", lessonId: id, score: v.score }) }).catch(() => {});
        if (n.drill !== cur.drill) fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "drill", n: n.drill }) }).catch(() => {});
      } else { try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} }
      return n;
    });
  }, []);
  return { p, update };
}
