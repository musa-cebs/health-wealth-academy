"use client";
import Link from "next/link";
import { WEEKS, LESSONS, bankFor } from "@/lib/content";
import { isUnlocked, prerequisite } from "@/lib/gating";
import { useProgress } from "@/lib/progress";
import { useMe } from "@/lib/me";

const Lock = () => (<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" fill="currentColor" /></svg>);

export default function Learn() {
  const { p, ready } = useProgress();
  const me = useMe();
  const preview = me.role === "leader";
  const nextId = LESSONS.find((l) => !p.done[l.id])?.id;
  return (
    <>
      <h2 style={{ marginTop: 16 }}>Your 8-week journey</h2>
      <p className="muted">Watch, check, practise, prove. Each lesson opens when you finish the one before it, and you can always go back to revisit anything you have done.</p>
      {preview && <div className="demo" style={{ marginTop: 10 }}>Leader preview: every lesson is open to you so you can review the content.</div>}
      {WEEKS.map((w) => {
        const dn = w.lessons.filter((l) => p.done[l.id]).length;
        return (
          <section className="week" key={w.n}>
            <h3>Week {w.n}: {w.title} <span className={`chip ${dn === w.lessons.length ? "" : "grey"}`}>{dn}/{w.lessons.length}</span></h3>
            <p className="small muted">{w.thread}</p>
            {w.lessons.map((l) => {
              const open = !ready || !me.ready ? true : isUnlocked(l.id, p.done, preview);
              const pre = prerequisite(l.id);
              const isNext = l.id === nextId;
              const inner = (<>
                <span className="lid">L{l.id}</span>
                <span>{l.title}<br /><span className="small muted">{open ? `${l.mins} min${isNext ? " · Up next" : ""}` : `Opens after L${pre?.id} is complete`}</span></span>
                {p.done[l.id] ? <span className="tick">✓ {bankFor(l.id) ? `${p.done[l.id].score}/10` : "Done"}</span> : !open ? <span className="lock"><Lock /></span> : isNext ? <span className="chip">Start</span> : null}
              </>);
              return open
                ? <Link key={l.id} href={`/lesson/${l.id}`} className={`lrow ${isNext ? "next" : ""}`} style={{ textDecoration: "none" }}>{inner}</Link>
                : <div key={l.id} className="lrow locked" aria-disabled="true">{inner}</div>;
            })}
            {w.gate && <div className="fb good small"><b>Gate:</b> {w.gate}</div>}
          </section>
        );
      })}
    </>
  );
}
