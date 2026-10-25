"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [["/", "Home"], ["/learn", "Learn"], ["/library", "Library"], ["/team", "Team"]] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h) || (h === "/learn" && path.startsWith("/lesson")));
  const tabs = TABS.map(([h, n]) => <Link key={h} href={h} className="tab" aria-current={active(h)}>{n}</Link>);
  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand">Health &amp; Wealth Academy<small>Wealth Journey Training Program</small></div>
          <div className="tabs">{tabs}</div>
        </div>
      </header>
      <div className="wrap">
        <main>{children}</main>
        <footer style={{ textAlign: "center", padding: "40px 0 12px", color: "var(--muted)", fontSize: 13 }}>Health &amp; Wealth Academy · Wealth Journey Training Program · Caring for people, before and after the sale.</footer>
      </div>
      <nav className="bottom" aria-label="Main">{tabs}</nav>
    </>
  );
}
