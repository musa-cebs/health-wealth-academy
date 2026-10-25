"use client";
import Link from "next/link";
import IntroVideo from "@/components/IntroVideo";
import { WEEKS, LESSONS, FRAMEWORK } from "@/lib/content";
import { useProgress } from "@/lib/progress";

const HOW = [
  ["Watch", "A short lecture from your presenters, five to eight minutes, made for your phone."],
  ["Check", "A marked quiz that confirms you understood. Eight out of ten to pass, and you can always try again."],
  ["Practise", "Talk to a lifelike customer in a safe space, then receive honest, specific feedback."],
  ["Prove", "Your progress is recorded, your badges are earned, and you move up the ladder."],
] as const;

export default function Home() {
  const { p } = useProgress();
  const done = LESSONS.filter((l) => p.done[l.id]).length;
  const next = LESSONS.find((l) => !p.done[l.id]) ?? LESSONS[0];
  const started = done > 0;

  return (
    <div className="lp">
      {/* ---------- Hero ---------- */}
      <section className="lp-bleed lp-hero">
        <div className="lp-in lp-center">
          <p className="lp-eyebrow">Wealth Journey · Distributor Training System</p>
          <h1 className="lp-h1">Where health becomes a journey, and a future.</h1>
          <p className="lp-lede">Learn the products, the conversations and the care that make Health &amp; Wealth different. Train on your phone, at your pace, and grow with people who believe in you.</p>
          <IntroVideo />
          <div className="lp-cta">
            <Link className="lp-btn gold" href={`/lesson/${next.id}`}>{started ? "Continue your journey" : "Begin your journey"}</Link>
            <Link className="lp-btn ghost" href="/learn">Explore the curriculum</Link>
          </div>
          <p className="lp-facts"><span>8 weeks</span><i /><span>{LESSONS.length} lessons</span><i /><span>3 certifications</span></p>
        </div>
      </section>

      {/* ---------- Promise ---------- */}
      <section className="lp-sec lp-center lp-quote">
        <span className="lp-rule" aria-hidden="true" />
        <blockquote>It is not a hit-and-run.<br />It is a health journey.</blockquote>
        <p className="lp-sub">We love and care for people. That means looking after every customer before the sale, after the sale, and even beyond products.</p>
        <span className="lp-rule" aria-hidden="true" />
      </section>

      {/* ---------- Journey ---------- */}
      <section className="lp-sec">
        <p className="lp-eyebrow dark">Your 8-week journey</p>
        <h2 className="lp-h2">From your first lesson to a confident, certified distributor.</h2>
        <ol className="lp-line">
          {WEEKS.map((w) => {
            const dn = w.lessons.filter((l) => p.done[l.id]).length, full = dn === w.lessons.length;
            return (
              <li key={w.n} className={full ? "is-done" : ""}>
                <span className="lp-dot" aria-hidden="true">{full ? "✓" : w.n}</span>
                <div>
                  <p className="lp-wk">Week {w.n}</p>
                  <h3>{w.title}</h3>
                  <p className="lp-it">{w.thread}</p>
                  <p className="lp-meta">{w.lessons.length} lessons · Earn the <b>{w.badge}</b> badge{dn > 0 && !full ? ` · ${dn} of ${w.lessons.length} done` : ""}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="lp-center" style={{ marginTop: 28 }}><Link className="lp-btn dark" href="/learn">See every lesson</Link></p>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="lp-bleed lp-band">
        <div className="lp-in">
          <p className="lp-eyebrow">How every lesson works</p>
          <h2 className="lp-h2 light">Learn it. Prove it. Live it.</h2>
          <ol className="lp-steps">
            {HOW.map(([t, d], i) => (<li key={t}><span className="lp-num">{i + 1}</span><div><h3>{t}</h3><p>{d}</p></div></li>))}
          </ol>
        </div>
      </section>

      {/* ---------- Presenters ---------- */}
      <section className="lp-sec lp-center">
        <p className="lp-eyebrow dark">Your guides</p>
        <h2 className="lp-h2">Learn from people who care how you succeed.</h2>
        <p className="lp-sub">Every lesson is taught by Sabelo, Lungile and Lerato, and backed by a coach that is with you whenever you have a question.</p>
        <ul className="lp-guides">
          {["Sabelo", "Lungile", "Lerato"].map((n) => (<li key={n}><span className="lp-av" aria-hidden="true">{n[0]}</span>{n}</li>))}
        </ul>
      </section>

      {/* ---------- Certification ---------- */}
      <section className="lp-sec">
        <p className="lp-eyebrow dark">Recognition you can be proud of</p>
        <h2 className="lp-h2">Three levels. One standard of excellence.</h2>
        <ol className="lp-ladder">
          {FRAMEWORK.levels.filter((l) => l[0].startsWith("Level")).map(([lv, title, when, req]) => (
            <li key={lv}><span className="lp-medal" aria-hidden="true">{lv.replace("Level ", "")}</span><div><h3>{title}</h3><p className="lp-meta">{when}</p><p>{req}</p></div></li>
          ))}
        </ol>
      </section>

      {/* ---------- Closing call ---------- */}
      <section className="lp-bleed lp-close">
        <div className="lp-in lp-center">
          <h2 className="lp-h2 light">Your journey starts with one lesson.</h2>
          <p className="lp-lede">It takes about half an hour. We will be with you every step.</p>
          <Link className="lp-btn gold" href={`/lesson/${next.id}`}>{started ? `Continue: L${next.id} ${next.title}` : `Start with L${next.id}`}</Link>
        </div>
      </section>
    </div>
  );
}
