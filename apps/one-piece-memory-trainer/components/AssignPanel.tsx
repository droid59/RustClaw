"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "./workspace";
import { CardImage, CardMeta, EffectText } from "./CardView";
import { suggestImage } from "@/lib/suggest";
import { FREE_LIMITS } from "@/lib/plans";
import type { Card } from "@/lib/types";

export function AssignPanel({ card, defaultLocus, onDone }: { card: Card; defaultLocus?: string | null; onDone: () => void }) {
  const { activeLoci, activeAssignments, data, assignCard, profile } = useWorkspace();
  const firstEmpty = activeLoci.find((l) => !activeAssignments.some((a) => a.locusId === l.id));
  const [locusId, setLocusId] = useState<string>(defaultLocus && activeLoci.some((l) => l.id === defaultLocus) ? defaultLocus : (firstEmpty ?? activeLoci[0])?.id ?? "");
  const [image, setImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [variant, setVariant] = useState(0);
  const [busy, setBusy] = useState(false);
  const locus = activeLoci.find((l) => l.id === locusId);

  // Reset when a different card is selected.
  useEffect(() => {
    setImage("");
    setTags([]);
    setVariant(0);
  }, [card.id]);

  function suggest() {
    const s = suggestImage({ name: card.name, effect: card.effect, locus: locus?.name, power: card.power, cost: card.cost }, variant);
    setImage(s.text);
    setTags(s.tags);
    setVariant((v) => v + 1);
  }

  async function place() {
    if (!locusId) return;
    setBusy(true);
    const finalImage = image.trim() || suggestImage({ name: card.name, effect: card.effect, locus: locus?.name, power: card.power, cost: card.cost }, 0).text;
    const ok = await assignCard(card, locusId, finalImage);
    setBusy(false);
    if (ok) onDone();
  }

  const used = data.assignments.length;
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="w-28 shrink-0 sm:w-36"><CardImage card={card} /></div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-extrabold leading-tight">{card.name}</h2>
          <CardMeta card={card} />
        </div>
      </div>
      <div className="rounded-xl bg-ink-900 p-3"><EffectText text={card.effect} /></div>

      <div>
        <label className="label" htmlFor="locus">Place at locus</label>
        <select id="locus" className="input" value={locusId} onChange={(e) => setLocusId(e.target.value)}>
          {activeLoci.map((l, i) => {
            const n = activeAssignments.filter((a) => a.locusId === l.id).length;
            return <option key={l.id} value={l.id}>{i + 1}. {l.name}{n ? ` (${n} card${n > 1 ? "s" : ""})` : ""}</option>;
          })}
        </select>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="label mb-0" htmlFor="image">Vivid image</label>
          <button type="button" onClick={suggest} className="btn-ghost btn-sm">✨ {variant ? "Suggest another" : "Suggest image"}</button>
        </div>
        <textarea
          id="image"
          className="input min-h-[110px]"
          placeholder={`Make it absurd, loud and emotional. What does ${card.name} DO at the ${locus?.name ?? "locus"}? What do you smell, hear, feel?`}
          value={image}
          onChange={(e) => setImage(e.target.value)}
        />
        {tags.length > 0 && <p className="mt-1.5 text-xs text-slate-500">Encodes: {tags.join(" · ")}</p>}
      </div>

      <button className="btn-primary w-full" onClick={place} disabled={busy || !locusId}>
        {busy ? "Placing…" : `Place at ${locus?.name ?? "locus"}`}
      </button>
      {!profile?.isPro && <p className="text-center text-xs text-slate-500">{used}/{FREE_LIMITS.cards} free cards used</p>}
    </div>
  );
}
