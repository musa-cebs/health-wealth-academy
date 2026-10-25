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
      <div className="wrap">
        <header className="top">
          <div className="brand">Health &amp; Wealth Academy<small>Distributor Training System</small></div>
          <div className="tabs">{tabs}</div>
        </header>
        <main>{children}</main>
      </div>
      <nav className="bottom" aria-label="Main">{tabs}</nav>
    </>
  );
}
