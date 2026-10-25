"use client";
import { useState } from "react";

export default function Coach({ lessonId, onClose }: { lessonId?: string; onClose: () => void }) {
  const [q, setQ] = useState(""); const [a, setA] = useState<{ q: string; text: string; err?: boolean } | null>(null); const [busy, setBusy] = useState(false);
  async function ask() {
    const question = q.trim(); if (!question || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, lessonId }) });
      const j = await r.json();
      setA({ q: question, text: r.ok ? j.answer : j.error, err: !r.ok });
    } catch { setA({ q: question, text: "Could not reach the coach. Check your connection and try again.", err: true }); }
    setBusy(false); setQ("");
  }
  return (
    <div className="sheet" role="dialog" aria-label="Ask the coach"><div className="in">
      <div className="row"><h3>Ask the coach</h3><button className="btn ghost" style={{ marginLeft: "auto", padding: "6px 12px" }} onClick={onClose}>Close</button></div>
      <p className="small muted">Answers come from approved Academy content. If the coach is unsure, it says so.</p>
      <div className="input-row"><input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Try: Can a customer take more than one a day?" aria-label="Question" autoFocus />
        <button className="btn" onClick={ask} disabled={busy}>{busy ? "…" : "Ask"}</button></div>
      {a && <div className="chat"><div className="bub me">{a.q}</div>{a.err ? <div className="err">{a.text}</div> : <div className="bub them" style={{ whiteSpace: "pre-wrap" }}>{a.text}</div>}</div>}
    </div></div>
  );
}
