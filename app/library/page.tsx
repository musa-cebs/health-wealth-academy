"use client";
import { useMemo, useState } from "react";
import { LIBRARY } from "@/lib/content";

export default function Library() {
  const [q, setQ] = useState(""); const [type, setType] = useState("All"); const [copied, setCopied] = useState<number | null>(null);
  const types = useMemo(() => ["All", ...new Set(LIBRARY.map((x) => x.type.split(" (")[0]))], []);
  const items = LIBRARY.filter((x) => (type === "All" || x.type.startsWith(type)) && (!q || (x.title + x.body + x.tags.join(" ")).toLowerCase().includes(q.toLowerCase())));
  async function copy(id: number, body: string) {
    try { await navigator.clipboard.writeText(body); setCopied(id); setTimeout(() => setCopied(null), 1200); } catch { setCopied(-1); }
  }
  return (
    <>
      <h2 style={{ marginTop: 16 }}>Resource library</h2>
      <p className="muted">Search by need, product or situation. Everything here is approved wording.</p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try: joints, medication, sleep" aria-label="Search the library" />
      <div className="row" style={{ margin: "10px 0" }}>{types.map((t) => <button key={t} className={`btn ${type === t ? "" : "ghost"}`} style={{ padding: "6px 12px", fontSize: 14 }} onClick={() => setType(t)}>{t}</button>)}</div>
      <div className="grid">
        {items.map((x) => (
          <div className="card" key={x.id}>
            <div className="row"><span className="chip">{x.type}</span>{x.status && <span className={`chip ${x.flag ? "red" : "amber"}`}>{x.status}</span>}</div>
            <h3 style={{ marginTop: 8 }}>{x.title}</h3><p className="small">{x.body}</p>
            {x.flag && <div className="fb bad small"><b>Compliance check:</b> {x.flag}</div>}
            <div className="row" style={{ marginTop: 8 }}>{x.tags.map((t) => <span className="chip grey" key={t}>{t}</span>)}
              <button className="btn sec" style={{ marginLeft: "auto", padding: "6px 12px", fontSize: 14 }} onClick={() => copy(x.id, x.body)}>{copied === x.id ? "Copied" : "Copy"}</button></div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">Nothing found. Try another word.</p>}
      </div>
    </>
  );
}
