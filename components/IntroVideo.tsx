"use client";
import { useState } from "react";

/** Set NEXT_PUBLIC_INTRO_VIDEO_URL to a direct video file (.mp4/.webm), a YouTube link or a Vimeo link. Without it, a "coming soon" message shows. */
const SRC = process.env.NEXT_PUBLIC_INTRO_VIDEO_URL ?? "";
const POSTER = process.env.NEXT_PUBLIC_INTRO_POSTER_URL ?? "";

function embedUrl(u: string): string | null {
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

export default function IntroVideo() {
  const [open, setOpen] = useState(false);
  const embed = SRC ? embedUrl(SRC) : null;
  return (
    <div className="iv" role="group" aria-label="Welcome video">
      {open && SRC && embed && <iframe className="iv-media" src={embed} title="Welcome to Health & Wealth Academy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
      {open && SRC && !embed && <video className="iv-media" src={SRC} poster={POSTER || undefined} controls autoPlay playsInline />}
      {!(open && SRC) && (
        <>
          <div className="iv-art" aria-hidden="true">
            <i className="leaf l1" /><i className="leaf l2" /><i className="leaf l3" />
            <i className="loz z1" /><i className="loz z2" /><i className="loz z3" /><i className="loz z4" /><i className="loz z5" /><i className="loz z6" />
          </div>
          {POSTER && <img className="iv-poster" src={POSTER} alt="" />}
          <div className="iv-cap">
            <span className="iv-kicker">A welcome from your presenters</span>
            <span className="iv-title">Sabelo, Lungile and Lerato</span>
          </div>
          <button className="iv-play" onClick={() => setOpen(true)} aria-label="Play the welcome video">
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
          </button>
          {open && !SRC && (
            <div className="iv-soon" role="status">
              <p className="iv-soon-t">Your welcome video is being recorded.</p>
              <p>Sabelo, Lungile and Lerato will greet you here and explain how the Academy will grow your health and your business.</p>
              <button className="lp-btn ghost" onClick={() => setOpen(false)}>Close</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
