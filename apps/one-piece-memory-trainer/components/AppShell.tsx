"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useWorkspace } from "./workspace";
import { SignIn } from "./AuthGate";
import { Logo } from "./Logo";
import { PLAN_FEATURES } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Home", icon: "◎" },
  { href: "/app/paths", label: "Path", icon: "⌂" },
  { href: "/app/add", label: "Add", icon: "+" },
  { href: "/app/review", label: "Review", icon: "↻" },
  { href: "/app/drill", label: "Drill", icon: "⚑" },
  { href: "/app/speed", label: "Speed", icon: "⚡" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

function Toasts() {
  const { toasts, dismiss } = useWorkspace();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flash-in flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-2xl ${
              t.kind === "error" ? "bg-blood-500 text-white" : t.kind === "upgrade" ? "bg-straw-400 text-ink-950" : "bg-ink-600 text-white"
            }`}
          >
            <span className="flex-1">{t.text}</span>
            {t.kind === "upgrade" && (
              <button className="rounded-lg bg-ink-950 px-2.5 py-1 text-xs font-bold text-straw-300" onClick={() => { dismiss(t.id); setUpgradeOpen(true); }}>
                Go Pro
              </button>
            )}
            <button aria-label="Dismiss" className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
      {upgradeOpen && <UpgradeDialog onClose={() => setUpgradeOpen(false)} />}
    </>
  );
}

export function UpgradeDialog({ onClose }: { onClose: () => void }) {
  const { startCheckout, mode } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const price = process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "$5/month";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel flash-in w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Upgrade to <span className="text-straw-400">Pro</span></h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400">✕</button>
        </div>
        <p className="mt-1 text-sm text-slate-400">{price} · cancel anytime</p>
        <ul className="mt-4 space-y-2 text-sm">
          {PLAN_FEATURES.pro.map((f) => <li key={f} className="flex gap-2"><span className="text-straw-400">★</span>{f}</li>)}
        </ul>
        {mode === "local" && <p className="mt-4 rounded-lg bg-ink-900 p-3 text-xs text-slate-400">You are in local mode (no account). Billing requires the hosted version with Supabase + Stripe configured.</p>}
        <button className="btn-primary mt-5 w-full" disabled={busy} onClick={async () => { setBusy(true); await startCheckout(); setBusy(false); }}>
          {busy ? "Opening checkout…" : "Continue to secure checkout"}
        </button>
      </div>
    </div>
  );
}

function UpgradeFromQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, status } = useWorkspace();
  const open = params.get("upgrade") === "1" && status === "ready" && !profile?.isPro;
  if (!open) return null;
  return <UpgradeDialog onClose={() => router.replace(pathname)} />;
}

function PathSwitcher() {
  const { data, activePath, setActivePath } = useWorkspace();
  if (data.paths.length < 2) return <span className="truncate text-sm font-semibold text-slate-300">{activePath?.name}</span>;
  return (
    <select aria-label="Active path" className="input max-w-[11rem] py-1.5" value={activePath?.id ?? ""} onChange={(e) => setActivePath(e.target.value)}>
      {data.paths.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, profile, mode } = useWorkspace();
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (status === "signed-out") return <SignIn />;
  if (status === "loading") {
    return <div className="grid min-h-screen place-items-center text-slate-400"><span className="animate-pulse">Loading your memory palace…</span></div>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-screen self-start flex-col border-r border-white/5 bg-ink-900 p-4 md:flex">
        <Logo href="/app" />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-straw-400/15 text-straw-300" : "text-slate-400 hover:bg-ink-800 hover:text-white"}`}>
                <span className="w-4 text-center">{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 text-xs text-slate-500">
          {profile?.isPro ? <span className="pro-badge">Pro</span> : <Link href="/app?upgrade=1" className="btn-primary btn-sm w-full">Upgrade to Pro</Link>}
          <p className="truncate pt-2">{mode === "local" ? "Local mode · saved in this browser" : profile?.email}</p>
        </div>
      </aside>

      <div className="pb-24 md:pb-8">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-ink-950/85 px-4 py-3 backdrop-blur md:px-8">
          <div className="md:hidden"><Logo href="/app" /></div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs uppercase tracking-wider text-slate-500 sm:inline">Path</span>
            <PathSwitcher />
          </div>
          {profile?.isPro && <span className="pro-badge hidden md:inline-flex">Pro</span>}
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">{status === "error" ? <p className="text-blood-400">Something went wrong loading your data. Refresh to try again.</p> : children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-white/10 bg-ink-900/95 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-straw-400" : "text-slate-500"}`}>
              <span className="text-base leading-none">{n.icon}</span>{n.label}
            </Link>
          );
        })}
      </nav>
      <Toasts />
      <Suspense><UpgradeFromQuery /></Suspense>
    </div>
  );
}
