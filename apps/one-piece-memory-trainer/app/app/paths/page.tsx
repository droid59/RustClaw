"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorkspace, DEFAULT_LOCI } from "@/components/workspace";
import { PageTitle } from "@/components/ui";
import { AssignmentRow } from "@/components/AssignmentRow";

function InlineEdit({ value, onSave, className = "" }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [v, setV] = useState(value);
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <button className={`text-left hover:text-straw-300 ${className}`} onClick={() => { setV(value); setEditing(true); }} title="Click to rename">
        {value}
      </button>
    );
  return (
    <form className="flex-1" onSubmit={(e) => { e.preventDefault(); onSave(v); setEditing(false); }}>
      <input autoFocus className="input py-1.5" value={v} maxLength={60} onChange={(e) => setV(e.target.value)} onBlur={() => { onSave(v); setEditing(false); }} />
    </form>
  );
}

export default function PathsPage() {
  const { data, activePath, activeLoci, activeAssignments, createPath, renamePath, deletePath, addLocus, renameLocus, moveLocus, deleteLocus, setActivePath, profile } = useWorkspace();
  const [newLocus, setNewLocus] = useState("");
  const [newPath, setNewPath] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageTitle title="Memory paths" subtitle="A path is a route through a place you know by heart. Each stop (locus) holds vivid card images." />

      <div className="panel space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {data.paths.map((p) => (
            <button key={p.id} onClick={() => setActivePath(p.id)} className={`btn-sm btn ${p.id === activePath?.id ? "bg-straw-400 text-ink-950" : "bg-ink-700 text-slate-300"}`}>
              {p.name}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await createPath(newPath || "New path", DEFAULT_LOCI)) setNewPath("");
          }}
        >
          <input className="input" placeholder="New path name (e.g. Bedroom, Commute, Gym)" value={newPath} maxLength={80} onChange={(e) => setNewPath(e.target.value)} />
          <button className="btn-ghost shrink-0">+ Path {!profile?.isPro && <span className="pro-badge">Pro</span>}</button>
        </form>
      </div>

      {activePath && (
        <div className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex-1 text-xl font-extrabold"><InlineEdit value={activePath.name} onSave={(v) => renamePath(activePath.id, v)} /></h2>
            <button className="btn-danger btn-sm" onClick={() => confirm(`Delete path “${activePath.name}” and all its cards? This cannot be undone.`) && deletePath(activePath.id)}>Delete path</button>
          </div>

          <ol className="space-y-2">
            {activeLoci.map((l, i) => {
              const here = activeAssignments.filter((a) => a.locusId === l.id);
              const isOpen = open === l.id;
              return (
                <li key={l.id} className="rounded-xl border border-white/5 bg-ink-900/50">
                  <div className="flex items-center gap-2 p-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-straw-400/15 text-sm font-extrabold text-straw-300">{i + 1}</span>
                    <div className="min-w-0 flex-1 font-semibold"><InlineEdit value={l.name} onSave={(v) => renameLocus(l.id, v)} /></div>
                    <button className="chip hover:bg-ink-600" onClick={() => setOpen(isOpen ? null : l.id)} aria-expanded={isOpen}>
                      {here.length} card{here.length === 1 ? "" : "s"} {isOpen ? "▴" : "▾"}
                    </button>
                    <button aria-label="Move up" className="btn-ghost btn-sm px-2" disabled={i === 0} onClick={() => moveLocus(l.id, -1)}>↑</button>
                    <button aria-label="Move down" className="btn-ghost btn-sm px-2" disabled={i === activeLoci.length - 1} onClick={() => moveLocus(l.id, 1)}>↓</button>
                    <button aria-label={`Delete ${l.name}`} className="btn-danger btn-sm px-2" onClick={() => (here.length === 0 || confirm(`Delete “${l.name}” and its ${here.length} card(s)?`)) && deleteLocus(l.id)}>✕</button>
                  </div>
                  {isOpen && (
                    <div className="space-y-2 border-t border-white/5 p-2.5">
                      {here.length ? here.map((a) => <AssignmentRow key={a.id} a={a} />) : <p className="text-sm text-slate-500">Empty. <Link href={`/app/add?locus=${l.id}`} className="text-straw-300 underline">Place a card here</Link>.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <form
            className="mt-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await addLocus(activePath.id, newLocus);
              setNewLocus("");
            }}
          >
            <input className="input" placeholder="Add a locus (e.g. Window, Oven mitt, Bin)" value={newLocus} maxLength={60} onChange={(e) => setNewLocus(e.target.value)} />
            <button className="btn-primary shrink-0">+ Locus</button>
          </form>
          <p className="mt-3 text-xs text-slate-500">Tip: choose stops you physically pass in a fixed order and that look distinct. 5–10 loci per room works best.</p>
        </div>
      )}
    </div>
  );
}
