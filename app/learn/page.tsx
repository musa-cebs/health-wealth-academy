"use client";
import Link from "next/link";
import { WEEKS } from "@/lib/content";
import { useProgress } from "@/lib/progress";

export default function Learn() {
  const { p } = useProgress();
  return (
    <>
      <h2 style={{ marginTop: 16 }}>Your 8-week journey</h2>
      <p className="muted">Watch, check, practise, prove. Each week ends with a badge.</p>
      {WEEKS.map((w) => {
        const dn = w.lessons.filter((l) => p.done[l.id]).length;
        return (
          <section className="week" key={w.n}>
            <h3>Week {w.n}: {w.title} <span className={`chip ${dn === w.lessons.length ? "" : "grey"}`}>{dn}/{w.lessons.length}</span></h3>
            <p className="small muted">{w.thread}</p>
            {w.lessons.map((l) => (
              <Link key={l.id} href={`/lesson/${l.id}`} className="lrow" style={{ textDecoration: "none" }}>
                <span className="lid">L{l.id}</span>
                <span>{l.title}<br /><span className="small muted">{l.mins} min</span></span>
                {p.done[l.id] && <span className="tick">✓ {p.done[l.id].score}/10</span>}
              </Link>
            ))}
            {w.gate && <div className="fb good small"><b>Gate:</b> {w.gate}</div>}
          </section>
        );
      })}
    </>
  );
}
