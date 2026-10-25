"use client";
import { useState } from "react";
import type { Question } from "@/lib/types";

/** Fisher-Yates shuffle of the questions and of each question's options, keeping the correct answer's index right. */
function shuffled(bank: Question[]): Question[] {
  const mix = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  return mix(bank).map((q) => {
    const idx = mix(q.o.map((_, i) => i));
    return { ...q, o: idx.map((i) => q.o[i]), a: idx.indexOf(q.a) };
  });
}

export default function Quiz({ bank, onDone }: { bank: Question[]; onDone: (score: number, total: number) => void }) {
  const [items, setItems] = useState<Question[]>(bank); // first attempt keeps the authored order; retakes are shuffled
  const [attempt, setAttempt] = useState(1);
  const [qi, setQi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const total = items.reduce((a, q) => a + q.m, 0);

  if (qi >= items.length) {
    const sc = marks.reduce((a, x) => a + x, 0), pass = sc / total >= 0.8;
    return (
      <div className="card"><div className="big">{sc}/{total}</div>
        <p>{pass ? "Passed. Great work." : "Not yet: the pass mark is 80%. Review the video chapters and try again; the questions come in a new order."}</p>
        <div className="row"><button className="btn" onClick={() => { setItems(shuffled(bank)); setAttempt(attempt + 1); setQi(0); setSel(null); setChecked(false); setMarks([]); }}>Retake</button></div>
      </div>
    );
  }
  const q = items[qi];
  const submit = () => { setMarks([...marks, sel === q.a ? q.m : 0]); setChecked(true); };
  const next = () => {
    const nq = qi + 1; setQi(nq); setSel(null); setChecked(false);
    if (nq >= items.length) { const sc = [...marks].reduce((a, x) => a + x, 0); onDone(sc, total); }
  };
  return (
    <div className="card">
      <div className="row"><span className="chip amber">Question {qi + 1} of {items.length}</span><span className="chip amber">{q.m} mark{q.m > 1 ? "s" : ""}</span>{attempt > 1 && <span className="chip grey">Attempt {attempt}</span>}</div>
      <h3 style={{ marginTop: 10 }}>{q.q}</h3>
      {q.o.map((o, i) => (
        <button key={i} disabled={checked} aria-pressed={sel === i} onClick={() => setSel(i)}
          className={`opt ${checked ? (i === q.a ? "right" : i === sel ? "wrong" : "") : ""}`}>{o}</button>
      ))}
      {checked
        ? <><div className={`fb ${sel === q.a ? "good" : "bad"}`}><b>{sel === q.a ? `Correct. +${q.m}` : "Not quite. 0 marks."}</b> {q.w}</div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={next}>{qi + 1 < items.length ? "Next question" : "See result"}</button></div></>
        : <div className="row" style={{ marginTop: 12 }}><button className="btn" disabled={sel === null} onClick={submit}>Check answer</button></div>}
    </div>
  );
}
