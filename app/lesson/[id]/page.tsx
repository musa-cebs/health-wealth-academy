"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bankFor, findLesson } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import Quiz from "@/components/Quiz";
import Roleplay from "@/components/Roleplay";
import Coach from "@/components/Coach";

type Step = "watch" | "check" | "practice" | "prove";
const ROLEPLAY: Record<string, string> = { "4.2": "thandi", "4.3": "thandi", "5.1": "thandi", "5.2": "sipho", "5.3": "thandi", "2.4": "nomsa", "3.3": "dlamini" };

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const lesson = findLesson(id);
  const { p, update } = useProgress();
  const [step, setStep] = useState<Step>("watch");
  const [vp, setVp] = useState(0); const [playing, setPlaying] = useState(false);
  const [quiz, setQuiz] = useState<{ score: number; total: number } | null>(null);
  const [practiced, setPracticed] = useState(false); const [coach, setCoach] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { setStep("watch"); setVp(0); setPlaying(false); setQuiz(null); setPracticed(false); }, [id]);

  if (!lesson) return <p style={{ marginTop: 24 }}>Lesson not found. <Link href="/learn">Back to the journey</Link></p>;
  const bank = bankFor(lesson.id);
  const done = p.done[lesson.id];

  function togglePlay() {
    if (playing) { if (timer.current) clearInterval(timer.current); setPlaying(false); return; }
    setPlaying(true);
    timer.current = setInterval(() => setVp((v) => { if (v >= 100) { if (timer.current) clearInterval(timer.current); setPlaying(false); return 100; } return v + 4; }), 400);
  }
  const steps: [Step, string, boolean][] = [["watch", "1 Watch", vp >= 100], ["check", "2 Check", !!quiz], ["practice", "3 Practise", practiced], ["prove", "4 Prove", !!done]];
  const rpId = ROLEPLAY[lesson.id];

  return (
    <>
      <div style={{ marginTop: 16 }}><Link className="btn ghost" href="/learn" style={{ display: "inline-block", textDecoration: "none" }}>← Journey</Link></div>
      <h2 style={{ marginTop: 12 }}>L{lesson.id} {lesson.title}</h2>
      <p className="small muted">Week {lesson.week}: {lesson.weekTitle}</p>
      <div className="steps">{steps.map(([k, n, d]) => <button key={k} className={`step ${d ? "done" : ""}`} aria-current={step === k} onClick={() => setStep(k)}>{n}</button>)}</div>

      {step === "watch" && <>
        <div className="iv lesson" role="group" aria-label="Lesson video">
          <div className="iv-art" aria-hidden="true"><i className="leaf l1" /><i className="leaf l2" /><i className="loz z1" /><i className="loz z2" /><i className="loz z3" /><i className="loz z4" /></div>
          <div className="iv-cap"><span className="iv-kicker">Lesson {lesson.id} · {lesson.mins} min · Presenter to be confirmed</span><span className="iv-title">{lesson.title}</span></div>
          <button className="iv-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing
            ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}</button>
          <div className="iv-bar"><i style={{ width: `${vp}%` }} /></div>
        </div>
        <p className="small muted">Placeholder player. The recorded lecture video will stream here, with captions and a low-data mode.</p>
        <h3 style={{ marginTop: 12 }}>Chapters</h3>
        {lesson.video.map((v, i) => <button key={i} className="chap" onClick={() => setVp(Math.round(((i + 1) / lesson.video.length) * 100))}><span className="lid">{i + 1}</span><span>{v}</span></button>)}
        <h3 style={{ marginTop: 14 }}>You will be able to</h3><ul>{lesson.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
        <div className="row"><button className="btn" onClick={() => setStep("check")}>{vp >= 100 ? "Continue to the quiz" : "Skip to the quiz"}</button></div></>}

      {step === "check" && (bank
        ? <><Quiz key={lesson.id} bank={bank} onDone={(score, total) => setQuiz({ score, total })} />
            {quiz && quiz.score / quiz.total >= 0.8 && <div className="row" style={{ marginTop: 12 }}><button className="btn sec" onClick={() => setStep("practice")}>Continue to practice</button></div>}</>
        : <div className="card"><h3>Quiz in production</h3><p>This lesson&rsquo;s question bank will be written with the presenter and reviewed for compliance. Lessons 1.1 and 1.3 have full quizzes.</p></div>)}

      {step === "practice" && (rpId
        ? <><Roleplay defaultPersona={rpId} onScored={() => setPracticed(true)} />{practiced && <div className="row" style={{ marginTop: 12 }}><button className="btn sec" onClick={() => setStep("prove")}>Continue</button></div>}</>
        : <div className="card"><h3>Practice</h3><p>{lesson.practice ?? "No practice task for this lesson."}</p>
            <p className="small muted">The AI roleplay is live for Lessons 2.4, 3.3, 4.2, 4.3 and 5.1 to 5.3.</p>
            <div className="row"><button className="btn sec" onClick={() => { setPracticed(true); setStep("prove"); }}>Continue</button></div></div>)}

      {step === "prove" && (
        <div className="card"><h3>Prove it</h3>
          <p>Quiz: <b>{quiz ? `${quiz.score}/${quiz.total}` : "not taken"}</b> (pass at 80%). Practice: <b>{practiced ? "done" : "optional here"}</b>.</p>
          {done ? <div className="fb good">Recorded: {done.score}/10. Nice work.</div>
            : <><button className="btn" disabled={!quiz || quiz.score / quiz.total < 0.8}
                onClick={() => update((x) => ({ ...x, done: { ...x.done, [lesson.id]: { score: Math.round((quiz!.score / quiz!.total) * 10) } } }))}>Mark lesson complete</button>
                <p className="small muted">{quiz ? (quiz.score / quiz.total >= 0.8 ? "" : "Retake the quiz to reach 80%.") : "Complete the quiz first."}</p></>}
          <div className="row" style={{ marginTop: 12 }}><Link className="btn sec" href="/learn" style={{ textDecoration: "none" }}>Back to the journey</Link></div>
        </div>)}

      <button className="btn coachbtn" onClick={() => setCoach(true)}>Ask the coach</button>
      {coach && <Coach lessonId={lesson.id} onClose={() => setCoach(false)} />}
    </>
  );
}
