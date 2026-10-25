"use client";
import { useRef, useState } from "react";
import { PERSONAS } from "@/lib/personas";
import type { Msg } from "@/lib/types";

type Result = { rows: { name: string; max: number; score: number }[]; total: number; pass: boolean; redFlags: { flag: string; quote: string }[]; strengths: string[]; improve: string[]; summary: string };

export default function Roleplay({ defaultPersona = "thandi", onScored }: { defaultPersona?: string; onScored?: (r: Result) => void }) {
  const [pid, setPid] = useState(defaultPersona);
  const persona = PERSONAS.find((p) => p.id === pid)!;
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: persona.opener }]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [res, setRes] = useState<Result | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const mine = msgs.filter((m) => m.role === "user").length;

  const reset = (id: string) => { const p = PERSONAS.find((x) => x.id === id)!; setPid(id); setMsgs([{ role: "assistant", content: p.opener }]); setRes(null); setErr(""); };
  async function send() {
    const t = text.trim(); if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }]; setMsgs(next); setText(""); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/roleplay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personaId: pid, messages: next }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error); setMsgs([...next, { role: "assistant", content: j.reply }]);
    } catch (e) { setErr((e as Error).message || "Something went wrong."); }
    setBusy(false); setTimeout(() => end.current?.scrollIntoView({ block: "nearest" }), 50);
  }
  async function finish() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personaId: pid, messages: msgs }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setRes(j); onScored?.(j);
    } catch (e) { setErr((e as Error).message || "Scoring failed."); }
    setBusy(false);
  }

  if (res) return (
    <div className="card"><div className="big">{res.total}/100</div>
      <p>{res.redFlags.length ? <span className="chip red">Red flag: automatic fail on this attempt</span> : res.pass ? <span className="chip">Pass</span> : <span className="chip amber">Below the pass mark of 75</span>}</p>
      <p>{res.summary}</p>
      <div className="score">{res.rows.map((r) => <div key={r.name} style={{ display: "contents" }}><span>{r.name}</span><b>{r.score}/{r.max}</b><div className="bar" style={{ gridColumn: "1/-1" }}><i style={{ width: `${(r.score / r.max) * 100}%` }} /></div></div>)}</div>
      {res.redFlags.map((f, i) => <div key={i} className="fb bad"><b>{f.flag}.</b> “{f.quote}”</div>)}
      {res.strengths.length > 0 && <><h3 style={{ marginTop: 14 }}>What you did well</h3><ul>{res.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {res.improve.length > 0 && <><h3>To improve</h3><ul>{res.improve.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={() => reset(pid)}>Try again</button></div>
    </div>
  );
  return (
    <div className="card">
      <div className="row"><span className="chip">AI roleplay</span>
        <select aria-label="Customer" value={pid} onChange={(e) => reset(e.target.value)} disabled={mine > 0} style={{ font: "inherit", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--fg)" }}>
          {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <p className="small muted">{persona.blurb} You are the distributor. Reply as you would on WhatsApp, then finish to be scored on the CLOSER scorecard.</p>
      <div className="chat">{msgs.map((m, i) => <div key={i} className={`bub ${m.role === "user" ? "me" : "them"}`}>{m.content}</div>)}<div ref={end} /></div>
      {busy && <div className="typing">…</div>}
      {err && <div className="err">{err}</div>}
      <div className="input-row" style={{ marginTop: 10 }}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type your reply" aria-label="Your reply" />
        <button className="btn" onClick={send} disabled={busy || !text.trim()}>Send</button></div>
      <div className="row" style={{ marginTop: 10 }}><button className="btn sec" onClick={finish} disabled={busy || mine < 3}>Finish and score me</button>
        {mine < 3 && <span className="small muted">Reply at least 3 times first.</span>}</div>
    </div>
  );
}
