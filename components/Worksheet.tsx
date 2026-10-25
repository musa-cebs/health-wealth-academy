"use client";
import { useState } from "react";

type Review = { ready: boolean; strengths: string; improve: string; hint: string };

export default function Worksheet({ onReady }: { onReady: () => void }) {
  const [goal, setGoal] = useState(""); const [promise, setPromise] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [rev, setRev] = useState<Review | null>(null);
  async function review() {
    setBusy(true); setErr(""); setRev(null);
    try {
      const r = await fetch("/api/worksheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: promise }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setRev(j); if (j.ready) onReady();
    } catch (e) { setErr((e as Error).message || "Something went wrong."); }
    setBusy(false);
  }
  return (
    <div className="card">
      <h3>Make it yours</h3>
      <p className="small muted">Two short pieces of writing. The coach reads your promise and tells you honestly whether it is specific and sincere.</p>
      <label htmlFor="goal" style={{ display: "block", fontWeight: 600, marginTop: 12 }}>1. Your 90-day goal</label>
      <p className="small muted" style={{ margin: "2px 0 6px" }}>What, how much, by when? For example: &ldquo;Help 20 customers feel looked after by the end of January.&rdquo;</p>
      <textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} className="ta" placeholder="My 90-day goal is…" />
      <label htmlFor="promise" style={{ display: "block", fontWeight: 600, marginTop: 14 }}>2. My Health &amp; Wealth promise</label>
      <p className="small muted" style={{ margin: "2px 0 6px" }}>In your own words: how will you care for your customers, even after they have bought?</p>
      <textarea id="promise" value={promise} onChange={(e) => setPromise(e.target.value)} rows={4} className="ta" placeholder="My promise to every customer is…" />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={review} disabled={busy || promise.trim().length < 20}>{busy ? "Reading…" : "Get the coach's feedback"}</button>
        {promise.trim().length < 20 && <span className="small muted">Write a couple of sentences first.</span>}
      </div>
      {err && <div className="err">{err}</div>}
      {rev && (
        <div className={`fb ${rev.ready ? "good" : "mid"}`} style={{ marginTop: 12 }}>
          <b>{rev.ready ? "That is a promise worth keeping." : "Nearly there."}</b> {rev.strengths}
          {rev.improve && <p style={{ margin: "8px 0 0" }}><b>To strengthen it:</b> {rev.improve}</p>}
          {rev.hint && <p style={{ margin: "6px 0 0" }}><i>For example: {rev.hint}</i></p>}
        </div>
      )}
    </div>
  );
}
