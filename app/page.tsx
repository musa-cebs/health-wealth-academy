"use client";
import Link from "next/link";
import { useState } from "react";
import { WEEKS, LESSONS, ALL_SAMPLES } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function Home() {
  const { p, update } = useProgress();
  const [picked, setPicked] = useState<number | null>(null);
  const done = LESSONS.filter((l) => p.done[l.id]).length;
  const pct = Math.round((done / LESSONS.length) * 100);
  const next = LESSONS.find((l) => !p.done[l.id]) ?? LESSONS[0];
  const d = ALL_SAMPLES[p.drill % ALL_SAMPLES.length];
  return (
    <>
      <div className="card hero" style={{ marginTop: 16 }}>
        <div className="ring" style={{ ["--p" as string]: pct }}><span>{pct}%</span></div>
        <div>
          <h2>Sawubona! Welcome back.</h2>
          <p className="muted">{done} of {LESSONS.length} lessons complete. Level 1 Certified Associate unlocks at the end of Week 3.</p>
          <Link className="btn" href={`/lesson/${next.id}`} style={{ display: "inline-block" }}>Continue: L{next.id} {next.title}</Link>
        </div>
      </div>
      <div className="grid">
        <div className="card"><h3>Daily 3-minute drill</h3><p className="small muted">One question a day keeps the learning fresh.</p>
          <p><b>{d.q}</b></p>
          {d.o.map((o, i) => (
            <button key={i} disabled={picked !== null} className={`opt ${picked !== null ? (i === d.a ? "right" : i === picked ? "wrong" : "") : ""}`} onClick={() => setPicked(i)}>{o}</button>
          ))}
          {picked !== null && <>
            <div className={`fb ${picked === d.a ? "good" : "bad"}`}>{picked === d.a ? "Correct. " : "Not quite. "}{d.w}</div>
            <button className="btn sec" style={{ marginTop: 8 }} onClick={() => { setPicked(null); update((x) => ({ ...x, drill: x.drill + 1 })); }}>Next drill</button></>}
        </div>
        <div className="card"><h3>Your badges</h3><p className="small muted">One for every week you complete.</p>
          <div className="row" style={{ marginTop: 8 }}>{WEEKS.map((w) => { const ok = w.lessons.every((l) => p.done[l.id]); return <span key={w.n} className={`chip ${ok ? "" : "grey"}`}>{ok ? "★ " : ""}{w.badge}</span>; })}</div></div>
        <div className="card"><h3>The Health &amp; Wealth way</h3><p>&ldquo;It is not a hit-and-run. It is a health journey.&rdquo;</p><p className="small muted">We love and care for people, before and after the sale.</p></div>
      </div>
    </>
  );
}
