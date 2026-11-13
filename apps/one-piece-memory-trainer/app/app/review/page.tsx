"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { Empty, GradeButtons, PageTitle } from "@/components/ui";
import { CardImage, CardMeta, EffectText } from "@/components/CardView";
import { useKeys } from "@/components/useKeys";
import type { Assignment, Grade } from "@/lib/types";

type Stage = "cue" | "image" | "effect";

export default function ReviewPage() {
  const { activeLoci, activeAssignments, grade, activePath } = useWorkspace();
  // Path order: loci by position, then cards in the order they were placed.
  const sequence = useMemo(() => {
    const out: { a: Assignment; locusIndex: number }[] = [];
    activeLoci.forEach((l, locusIndex) => {
      activeAssignments.filter((a) => a.locusId === l.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt)).forEach((a) => out.push({ a, locusIndex }));
    });
    return out;
    // Freeze the sequence for the session so grading doesn't reorder it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath?.id, activeLoci.length, activeAssignments.length]);

  const [i, setI] = useState(0);
  const [stage, setStage] = useState<Stage>("cue");
  const [results, setResults] = useState<{ a: Assignment; g: Grade }[]>([]);
  const done = i >= sequence.length;
  const current = sequence[i];
  const locus = current ? activeLoci[current.locusIndex] : null;

  const reveal = useCallback(() => setStage((s) => (s === "cue" ? "image" : "effect")), []);
  const onGrade = useCallback(
    (g: Grade) => {
      if (!current) return;
      void grade(current.a.id, g, "review");
      setResults((r) => [...r, { a: current.a, g }]);
      setI((x) => x + 1);
      setStage("cue");
    },
    [current, grade],
  );

  useKeys(
    useCallback(
      (k: string) => {
        if (done) return;
        if (k === " " || k === "Enter") stage !== "effect" && reveal();
        else if (stage === "effect" && ["1", "2", "3", "4"].includes(k)) onGrade((Number(k) - 1) as Grade);
      },
      [done, stage, reveal, onGrade],
    ),
  );

  if (!sequence.length) return <><PageTitle title="Review" /><Empty title="Your path is empty" body="Place at least one card on a locus, then walk the path here." href="/app/add" cta="Add a card" /></>;

  if (done) {
    const correct = results.filter((r) => r.g >= 2).length;
    const missed = results.filter((r) => r.g < 2);
    return (
      <div className="space-y-4">
        <PageTitle title="Path complete" subtitle={`${activePath?.name}: ${correct}/${results.length} recalled`} />
        <div className="panel text-center">
          <p className="text-5xl font-extrabold text-straw-400">{results.length ? Math.round((correct / results.length) * 100) : 0}%</p>
          <p className="mt-1 text-sm text-slate-400">recall on this walk</p>
        </div>
        {missed.length > 0 && (
          <div className="panel">
            <h2 className="font-bold">Strengthen these images</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {missed.map(({ a }) => <li key={a.id}><b>{activeLoci.find((l) => l.id === a.locusId)?.name}</b> · {a.card.name} — <span className="italic text-slate-400">“{a.image}”</span></li>)}
            </ul>
            <Link href="/app/paths" className="btn-ghost btn-sm mt-3">Edit images</Link>
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => { setI(0); setResults([]); setStage("cue"); }}>Walk again</button>
          <Link href="/app/drill" className="btn-ghost flex-1">Drill randomly</Link>
        </div>
      </div>
    );
  }

  const { a } = current;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle title="Review" subtitle="Walk the path in order. Picture the place, recall the scene, then the effect." />
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-straw-400 transition-all" style={{ width: `${(i / sequence.length) * 100}%` }} /></div>
        <span className="text-xs tabular-nums text-slate-500">{i + 1}/{sequence.length}</span>
      </div>

      <div className="panel flash-in space-y-4" key={a.id}>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Locus {current.locusIndex + 1}</p>
          <p className="text-3xl font-extrabold text-straw-300">{locus?.name}</p>
          {stage === "cue" && <p className="mt-2 text-sm text-slate-400">What happens here? Picture it, then reveal.</p>}
        </div>

        {stage !== "cue" && (
          <div className="flash-in flex gap-4">
            <div className="w-24 shrink-0"><CardImage card={a.card} hideText /></div>
            <div className="min-w-0 space-y-2">
              <p className="font-bold">{a.card.name}</p>
              <p className="text-sm italic text-straw-200/90">“{a.image}”</p>
              {stage === "image" && <p className="text-xs text-slate-500">Now recall the exact effect.</p>}
            </div>
          </div>
        )}

        {stage === "effect" && (
          <div className="flash-in space-y-3 rounded-xl bg-ink-900 p-3">
            <CardMeta card={a.card} />
            <EffectText text={a.card.effect} />
          </div>
        )}

        {stage === "effect" ? (
          <GradeButtons onGrade={onGrade} />
        ) : (
          <button className="btn-primary w-full py-3" onClick={reveal}>{stage === "cue" ? "Reveal image" : "Reveal effect"}</button>
        )}
      </div>
      <p className="hidden text-center text-xs text-slate-500 sm:block">Space: reveal · 1–4: grade</p>
    </div>
  );
}
