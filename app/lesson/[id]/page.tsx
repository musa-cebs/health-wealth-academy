"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bankFor, findLesson, LESSONS } from "@/lib/content";
import { isUnlocked, prerequisite } from "@/lib/gating";
import { useProgress } from "@/lib/progress";
import { useMe } from "@/lib/me";
import { useStage } from "@/lib/stage";
import Quiz from "@/components/Quiz";
import Roleplay from "@/components/Roleplay";
import Coach from "@/components/Coach";
import Worksheet from "@/components/Worksheet";

type Step = "watch" | "check" | "practice" | "prove";
const ROLEPLAY: Record<string, string> = { "4.2": "thandi", "4.3": "thandi", "5.1": "thandi", "5.2": "sipho", "5.3": "thandi", "2.4": "nomsa", "3.3": "dlamini" };
const HINT: Record<Step, string> = { watch: "", check: "Finish the video first (tap “I’ve watched this lesson”).", practice: "Pass the quiz first (80%).", prove: "Finish the practice first." };

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const lesson = findLesson(id);
  const { p, update, ready } = useProgress();
  const me = useMe();
  const { stage, patch, ready: stageReady } = useStage(id, me.id || "anon");
  const [step, setStep] = useState<Step>("watch");
  const [vp, setVp] = useState(0); const [playing, setPlaying] = useState(false);
  const [coach, setCoach] = useState(false); const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { setStep("watch"); setVp(0); setPlaying(false); setNote(""); }, [id]);
  useEffect(() => { if (vp >= 100 && !stage.watched) patch({ watched: true }); }, [vp, stage.watched, patch]);

  if (!lesson) return <p style={{ marginTop: 24 }}>Lesson not found. <Link href="/learn">Back to the journey</Link></p>;
  if (!ready || !me.ready || !stageReady) return <p className="muted" style={{ marginTop: 24 }}>Loading your lesson…</p>;

  const preview = me.role === "leader";
  if (!isUnlocked(lesson.id, p.done, preview)) {
    const pre = prerequisite(lesson.id)!;
    const next = LESSONS.find((l) => !p.done[l.id]);
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <h2>This lesson is not open yet</h2>
        <p>Lessons open in order so nothing is missed. Finish <b>L{pre.id} {pre.title}</b> first.</p>
        <div className="row"><Link className="btn" href={`/lesson/${next?.id ?? pre.id}`} style={{ textDecoration: "none" }}>Go to your next lesson</Link><Link className="btn ghost" href="/learn" style={{ textDecoration: "none" }}>See the journey</Link></div>
      </div>
    );
  }

  const bank = bankFor(lesson.id);
  const done = p.done[lesson.id];
  const rpId = ROLEPLAY[lesson.id];
  const isWorksheet = lesson.id === "1.1";
  // What is finished. A lesson with no quiz or no practice task yet never blocks the learner.
  const watchDone = Boolean(stage.watched) || Boolean(done);
  const quizDone = Boolean(done) || (watchDone && (!bank || Boolean(stage.quizPassed)));
  const practiceDone = Boolean(done) || (quizDone && (Boolean(stage.practiced) || (!rpId && !isWorksheet && !lesson.practice)));
  const open: Record<Step, boolean> = { watch: true, check: watchDone || preview, practice: quizDone || preview, prove: practiceDone || preview };
  const finished: Record<Step, boolean> = { watch: watchDone, check: quizDone && (Boolean(bank) || watchDone), practice: practiceDone, prove: Boolean(done) };
  const go = (s: Step) => { if (open[s]) { setStep(s); setNote(""); } else setNote(HINT[s]); };

  function togglePlay() {
    if (playing) { if (timer.current) clearInterval(timer.current); setPlaying(false); return; }
    setPlaying(true);
    timer.current = setInterval(() => setVp((v) => { if (v >= 100) { if (timer.current) clearInterval(timer.current); setPlaying(false); return 100; } return v + 4; }), 400);
  }
  const steps: [Step, string][] = [["watch", "1 Watch"], ["check", "2 Check"], ["practice", "3 Practise"], ["prove", "4 Prove"]];

  return (
    <>
      <div style={{ marginTop: 16 }}><Link className="btn ghost" href="/learn" style={{ display: "inline-block", textDecoration: "none" }}>← Journey</Link></div>
      <h2 style={{ marginTop: 12 }}>L{lesson.id} {lesson.title}</h2>
      <p className="small muted">Week {lesson.week}: {lesson.weekTitle}{preview && " · Leader preview"}</p>
      <div className="steps">{steps.map(([k, n]) => (
        <button key={k} className={`step ${finished[k] ? "done" : ""} ${open[k] ? "" : "locked"}`} aria-current={step === k} aria-disabled={!open[k]} onClick={() => go(k)}>{n}</button>))}</div>
      {note && <div className="fb mid small" role="status">{note}</div>}

      {step === "watch" && <>
        <div className="iv lesson" role="group" aria-label="Lesson video">
          <div className="iv-art" aria-hidden="true"><i className="leaf l1" /><i className="leaf l2" /><i className="loz z1" /><i className="loz z2" /><i className="loz z3" /><i className="loz z4" /></div>
          <div className="iv-cap"><span className="iv-kicker">Lesson {lesson.id} · {lesson.mins} min · Presenter to be confirmed</span><span className="iv-title">{lesson.title}</span></div>
          <button className="iv-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing
            ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}</button>
          <div className="iv-bar"><i style={{ width: `${watchDone ? 100 : vp}%` }} /></div>
        </div>
        <p className="small muted">Placeholder player. The recorded lecture video will stream here, with captions and a low-data mode.</p>
        <h3 style={{ marginTop: 12 }}>Chapters</h3>
        {lesson.video.map((v, i) => <button key={i} className="chap" onClick={() => setVp(Math.round(((i + 1) / lesson.video.length) * 100))}><span className="lid">{i + 1}</span><span>{v}</span></button>)}
        <h3 style={{ marginTop: 14 }}>You will be able to</h3><ul>{lesson.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
        <div className="row"><button className="btn" onClick={() => { patch({ watched: true }); setStep("check"); setNote(""); }}>{watchDone ? "Continue to the quiz" : "I’ve watched this lesson"}</button></div></>}

      {step === "check" && (bank
        ? <><Quiz key={lesson.id} bank={bank} onDone={(score, total) => patch(score / total >= 0.8 ? { quizScore: score, quizTotal: total, quizPassed: true } : stage.quizPassed ? {} : { quizScore: score, quizTotal: total })} />
            {(stage.quizPassed || done) && <div className="row" style={{ marginTop: 12 }}><button className="btn sec" onClick={() => go("practice")}>Continue to practice</button></div>}</>
        : <div className="card"><h3>Quiz coming soon</h3><p>This lesson&rsquo;s questions are being written with the presenter and reviewed for compliance. You can carry on.</p>
            <div className="row"><button className="btn sec" onClick={() => go("practice")}>Continue to practice</button></div></div>)}

      {step === "practice" && (rpId
        ? <><Roleplay defaultPersona={rpId} onScored={() => patch({ practiced: true })} />{(stage.practiced || done) && <div className="row" style={{ marginTop: 12 }}><button className="btn sec" onClick={() => go("prove")}>Continue</button></div>}</>
        : isWorksheet
          ? <><Worksheet onReady={() => patch({ practiced: true })} />{(stage.practiced || done) && <div className="row" style={{ marginTop: 12 }}><button className="btn sec" onClick={() => go("prove")}>Continue</button></div>}</>
          : <div className="card"><h3>Practice</h3><p>{lesson.practice ?? "There is no practice task for this lesson."}</p>
              <p className="small muted">Live AI practice is available in Lessons 2.4, 3.3, 4.2, 4.3 and 5.1 to 5.3. More lessons will gain their own practice soon.</p>
              <div className="row"><button className="btn sec" onClick={() => { patch({ practiced: true }); setStep("prove"); setNote(""); }}>Continue</button></div></div>)}

      {step === "prove" && (
        <div className="card"><h3>Prove it</h3>
          <p>Quiz: <b>{bank ? (stage.quizTotal ? `${stage.quizScore}/${stage.quizTotal}` : done ? "passed" : "not taken") : "coming soon"}</b>{bank && " (pass at 80%)"}. Practice: <b>{practiceDone ? "done" : "not yet"}</b>.</p>
          {done ? <div className="fb good">Completed{bank ? `: ${done.score}/10` : ""}. Nice work.</div>
            : <button className="btn" disabled={!practiceDone} onClick={() => update((x) => ({ ...x, done: { ...x.done, [lesson.id]: { score: bank && stage.quizTotal ? Math.round(((stage.quizScore ?? 0) / stage.quizTotal) * 10) : 0 } } }))}>Mark lesson complete</button>}
          <div className="row" style={{ marginTop: 12 }}>
            {done && (() => { const n = LESSONS[LESSONS.findIndex((l) => l.id === lesson.id) + 1]; return n ? <Link className="btn" href={`/lesson/${n.id}`} style={{ textDecoration: "none" }}>Next: L{n.id} {n.title}</Link> : null; })()}
            <Link className="btn sec" href="/learn" style={{ textDecoration: "none" }}>Back to the journey</Link></div>
        </div>)}

      <button className="btn coachbtn" onClick={() => setCoach(true)}>Ask the coach</button>
      {coach && <Coach lessonId={lesson.id} onClose={() => setCoach(false)} />}
    </>
  );
}
