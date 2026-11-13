"use client";

import { useState } from "react";
import { useWorkspace } from "./workspace";
import type { Card } from "@/lib/types";

const COLORS = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"];
const TYPES = ["CHARACTER", "EVENT", "STAGE", "LEADER"];

export function UploadForm({ onCreated }: { onCreated: (c: Card) => void }) {
  const { addUserCard } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", code: "", effect: "", cost: "", power: "", counter: "", color: "Red", type: "CHARACTER" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const card = await addUserCard(
      { name: f.name.trim(), code: f.code.trim() || "CUSTOM", effect: f.effect.trim(), cost: num(f.cost), power: num(f.power), counter: num(f.counter), color: f.color, type: f.type, set: "My uploads", rarity: "" },
      file,
    );
    setBusy(false);
    if (card) {
      setF({ ...f, name: "", code: "", effect: "", cost: "", power: "", counter: "" });
      setFile(null);
      setPreview(null);
      onCreated(card);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-3">
        <label className="grid aspect-[63/88] w-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-white/15 bg-ink-900 text-center text-xs text-slate-500 hover:border-straw-400/50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span>📷<br />Card front<br />(optional)</span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setFile(file);
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        <div className="flex-1 space-y-3">
          <div>
            <label className="label" htmlFor="u-name">Card name *</label>
            <input id="u-name" required className="input" value={f.name} maxLength={80} onChange={set("name")} />
          </div>
          <div>
            <label className="label" htmlFor="u-code">Card code</label>
            <input id="u-code" className="input" placeholder="e.g. OP05-119" value={f.code} maxLength={20} onChange={set("code")} />
          </div>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="u-effect">Effect text</label>
        <textarea id="u-effect" className="input min-h-[90px]" placeholder="[On Play] Draw 1 card..." value={f.effect} onChange={set("effect")} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label" htmlFor="u-cost">Cost</label><input id="u-cost" inputMode="numeric" className="input" value={f.cost} onChange={set("cost")} /></div>
        <div><label className="label" htmlFor="u-power">Power</label><input id="u-power" inputMode="numeric" className="input" value={f.power} onChange={set("power")} /></div>
        <div><label className="label" htmlFor="u-counter">Counter</label><input id="u-counter" inputMode="numeric" className="input" value={f.counter} onChange={set("counter")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label" htmlFor="u-color">Color</label><select id="u-color" className="input" value={f.color} onChange={set("color")}>{COLORS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className="label" htmlFor="u-type">Type</label><select id="u-type" className="input" value={f.type} onChange={set("type")}>{TYPES.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <button className="btn-primary w-full" disabled={busy || !f.name.trim()}>{busy ? "Saving…" : "Save card"}</button>
    </form>
  );
}
