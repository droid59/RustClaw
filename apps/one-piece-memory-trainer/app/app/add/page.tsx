"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace";
import { PageTitle } from "@/components/ui";
import { CardImage } from "@/components/CardView";
import { AssignPanel } from "@/components/AssignPanel";
import { UploadForm } from "@/components/UploadForm";
import type { Card } from "@/lib/types";

type Tab = "database" | "uploads" | "new";
const COLORS = ["", "Red", "Green", "Blue", "Purple", "Black", "Yellow"];

interface CardResponse { total: number; results: Card[]; sets: string[]; source: "live" | "cache" | "snapshot" | "demo"; fetchedAt: string }

function CardGrid({ cards, placed, onPick, selected }: { cards: Card[]; placed: Set<string>; onPick: (c: Card) => void; selected?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      {cards.map((c) => (
        <button key={c.id} onClick={() => onPick(c)} className={`group relative rounded-xl text-left transition ${selected === c.id ? "ring-2 ring-straw-400" : "hover:ring-2 hover:ring-white/20"}`}>
          <CardImage card={c} />
          <p className="mt-1 truncate px-0.5 text-[11px] font-semibold text-slate-300">{c.name}</p>
          {placed.has(c.id) && <span className="absolute right-1 top-1 rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-ink-950">Placed</span>}
        </button>
      ))}
    </div>
  );
}

function AddInner() {
  const params = useSearchParams();
  const { data, deleteUserCard } = useWorkspace();
  const [tab, setTab] = useState<Tab>("database");
  const [q, setQ] = useState("");
  const [color, setColor] = useState("");
  const [set, setSet] = useState("");
  const [res, setRes] = useState<CardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Card | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const placed = new Set(data.assignments.map((a) => a.card.id));

  useEffect(() => {
    if (tab !== "database") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams({ q, color, set, limit: "40", offset: String(offset) });
        const r = await fetch(`/api/cards?${sp}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body: CardResponse = await r.json();
        setRes((prev) => (offset && prev ? { ...body, results: [...prev.results, ...body.results] } : body));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't reach the card database. You can still upload your own cards.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, color, set, offset, tab]);

  const pick = (c: Card) => {
    setSelected(c);
    // On mobile the panel is below the grid; bring it into view.
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div>
      <PageTitle title="Add cards" subtitle="Pick a card, accept or write a vivid image, and drop it on a locus." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-1 rounded-xl bg-ink-800 p-1 text-sm font-semibold">
            {([["database", "Card database"], ["uploads", `My uploads (${data.userCards.length})`], ["new", "Upload card"]] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-3 py-2 ${tab === t ? "bg-ink-600 text-white" : "text-slate-400"}`}>{label}</button>
            ))}
          </div>

          {tab === "database" && (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input className="input" placeholder="Search name, code or effect (e.g. “blocker”, “OP01-016”)" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
                <select className="input w-auto" aria-label="Color" value={color} onChange={(e) => { setColor(e.target.value); setOffset(0); }}>
                  {COLORS.map((c) => <option key={c} value={c}>{c || "Any color"}</option>)}
                </select>
                <select className="input w-auto" aria-label="Set" value={set} onChange={(e) => { setSet(e.target.value); setOffset(0); }}>
                  <option value="">Any set</option>
                  {res?.sets.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {res && (
                <p className="text-xs text-slate-500">
                  {res.total} cards ·{" "}
                  {res.source === "demo" ? (
                    <span className="text-orange-300">Live card database unreachable — showing fictional demo cards. Upload your own cards meanwhile.</span>
                  ) : (
                    <>source: {res.source} · updated {new Date(res.fetchedAt).toLocaleDateString()}</>
                  )}
                </p>
              )}
              {error && <p className="text-sm text-blood-400">{error}</p>}
              {res && <CardGrid cards={res.results} placed={placed} onPick={pick} selected={selected?.id} />}
              {loading && <p className="animate-pulse text-center text-sm text-slate-500">Loading cards…</p>}
              {res && res.results.length < res.total && !loading && (
                <button className="btn-ghost w-full" onClick={() => setOffset(res.results.length)}>Load more</button>
              )}
            </>
          )}

          {tab === "uploads" &&
            (data.userCards.length ? (
              <div className="space-y-3">
                <CardGrid cards={data.userCards} placed={placed} onPick={pick} selected={selected?.id} />
                {selected?.source === "upload" && (
                  <button className="btn-danger btn-sm" onClick={() => { if (confirm(`Delete uploaded card “${selected.name}”? Placed copies stay on your path.`)) { void deleteUserCard(selected.id); setSelected(null); } }}>
                    Delete “{selected.name}” from uploads
                  </button>
                )}
              </div>
            ) : (
              <p className="panel text-sm text-slate-400">No uploads yet. Use “Upload card” to add a card from a photo — handy for new sets, promos or proxies.</p>
            ))}

          {tab === "new" && (
            <div className="panel">
              <UploadForm onCreated={(c) => { setTab("uploads"); pick(c); }} />
            </div>
          )}
        </div>

        <div ref={panelRef} className="lg:sticky lg:top-20 lg:self-start">
          <div className="panel">
            {selected ? (
              <AssignPanel card={selected} defaultLocus={params.get("locus")} onDone={() => setSelected(null)} />
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">
                <p className="text-3xl">🃏</p>
                <p className="mt-2">Select a card to place it on your path.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddPage() {
  return <Suspense><AddInner /></Suspense>;
}
