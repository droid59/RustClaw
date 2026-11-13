"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Grade } from "@/lib/types";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="panel py-10 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{body}</p>
      {href && <Link href={href} className="btn-primary mt-5">{cta}</Link>}
    </div>
  );
}

const GRADES: { g: Grade; label: string; hint: string; cls: string }[] = [
  { g: 0, label: "Again", hint: "Forgot", cls: "bg-blood-500/20 text-blood-400 hover:bg-blood-500/30" },
  { g: 1, label: "Hard", hint: "Partial", cls: "bg-orange-500/15 text-orange-300 hover:bg-orange-500/25" },
  { g: 2, label: "Good", hint: "Recalled", cls: "bg-sea-500/15 text-sea-400 hover:bg-sea-500/25" },
  { g: 3, label: "Easy", hint: "Instant", cls: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" },
];

export function GradeButtons({ onGrade }: { onGrade: (g: Grade) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map(({ g, label, hint, cls }) => (
        <button key={g} onClick={() => onGrade(g)} className={`btn flex-col gap-0 py-3 ${cls}`}>
          {label}
          <span className="text-[10px] font-normal opacity-70">{hint}</span>
        </button>
      ))}
    </div>
  );
}

export function ProLock({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel relative overflow-hidden">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 grid place-items-center bg-ink-900/40 p-4 text-center">
        <div>
          <span className="pro-badge">Pro</span>
          <p className="mt-2 font-bold">{title}</p>
          <Link href="?upgrade=1" className="btn-primary btn-sm mt-3">Unlock with Pro</Link>
        </div>
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="panel">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${accent ? "text-straw-400" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
