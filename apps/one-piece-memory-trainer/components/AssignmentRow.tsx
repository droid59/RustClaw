"use client";

import { useState } from "react";
import { useWorkspace } from "./workspace";
import { CardImage, EffectText } from "./CardView";
import { suggestImage } from "@/lib/suggest";
import type { Assignment } from "@/lib/types";
import { isMastered } from "@/lib/stats";

export function AssignmentRow({ a }: { a: Assignment }) {
  const { activeLoci, updateAssignment, removeAssignment } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [image, setImage] = useState(a.image);
  const [variant, setVariant] = useState(1);
  const locus = activeLoci.find((l) => l.id === a.locusId);

  return (
    <div className="flex gap-3 rounded-xl bg-ink-900/70 p-3">
      <div className="w-14 shrink-0"><CardImage card={a.card} hideText /></div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold">{a.card.name}</p>
          <span className="chip">{a.card.code}</span>
          {isMastered(a) && <span className="chip bg-straw-400/15 text-straw-300">Mastered</span>}
          <span className="text-[11px] text-slate-500">{a.stats.correct}✓ {a.stats.wrong}✗</span>
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea className="input min-h-[90px]" value={image} onChange={(e) => setImage(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn-sm" onClick={() => { setImage(suggestImage({ ...a.card, locus: locus?.name }, variant).text); setVariant((v) => v + 1); }}>✨ Suggest</button>
              <select className="input w-auto py-1 text-xs" value={a.locusId} onChange={(e) => updateAssignment(a.id, { locusId: e.target.value })} aria-label="Move to locus">
                {activeLoci.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <button className="btn-primary btn-sm" onClick={async () => { await updateAssignment(a.id, { image }); setEditing(false); }}>Save</button>
              <button className="btn-ghost btn-sm" onClick={() => { setImage(a.image); setEditing(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-straw-200/90">“{a.image || "No image yet"}”</p>
        )}
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer select-none">Effect</summary>
          <div className="mt-1"><EffectText text={a.card.effect} /></div>
        </details>
        {!editing && (
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-danger btn-sm" onClick={() => confirm(`Remove ${a.card.name} from this path?`) && removeAssignment(a.id)}>Remove</button>
          </div>
        )}
      </div>
    </div>
  );
}
