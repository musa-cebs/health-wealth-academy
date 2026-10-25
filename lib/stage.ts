"use client";
import { useCallback, useEffect, useState } from "react";

/** Where a learner is inside one lesson. Kept in this browser so leaving and returning does not restart the lesson. */
export type Stage = { watched?: boolean; quizPassed?: boolean; quizScore?: number; quizTotal?: number; practiced?: boolean };
const KEY = "hw-stage-v1";

export function useStage(lessonId: string, owner: string) {
  const [stage, setStage] = useState<Stage>({});
  const [ready, setReady] = useState(false);
  const k = `${KEY}:${owner}`;
  useEffect(() => {
    try { const m = JSON.parse(localStorage.getItem(k) || "{}"); setStage(m[lessonId] || {}); } catch { setStage({}); }
    setReady(true);
  }, [lessonId, k]);
  const patch = useCallback((s: Stage) => {
    setStage((cur) => {
      const n = { ...cur, ...s };
      try { const m = JSON.parse(localStorage.getItem(k) || "{}"); m[lessonId] = n; localStorage.setItem(k, JSON.stringify(m)); } catch {}
      return n;
    });
  }, [lessonId, k]);
  return { stage, patch, ready };
}
