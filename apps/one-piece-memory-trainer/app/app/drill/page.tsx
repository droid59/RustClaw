"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace";
import { Empty, GradeButtons, PageTitle } from "@/components/ui";
import { CardImage, CardMeta, EffectText } from "@/components/CardView";
import { useKeys } from "@/components/useKeys";
import { isDue } from "@/lib/srs";
import type { Assignment, Grade } from "@/lib/types";

type Cue = "locus" | "card" | "due";

function pickNext(pool: Assignment[], lastId: string | null): Assignment | null {
  if (!pool.length) return null;
  const options = pool.length > 1 ? pool.filter((a) => a.id !== lastId) : pool;
  // Bias towards weaker cards: weight = 1 + wrong - min(streak, 3)
  const weights = options.map((a) => Math.max(0.5, 1 + a.stats.wrong - Math.min(a.stats.streak, 3) * 0.3));
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

function DrillInner() {
  const params = useSearchParams();
  const { activeAssignments, activeLoci, data, profile, grade } = useWorkspace();
  const isPro = Boolean(profile?.isPro);
  const [cue, setCue] = useState<Cue>(params.get("mode") === "due" && isPro ? "due" : "locus");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [session, setSession] = useState({ n: 0, correct: 0 });

  // Due queue spans all paths, sorted by most overdue.
  const duePool = useMemo(() => data.assignments.filter((a) => isDue(a.srs)).sort((a, b) => a.srs.due.localeCompare(b.srs.due)), [data.assignments]);
  const pool = cue === "due" ? duePool : activeAssignments;
  const current = data.assignments.find((a) => a.id === currentId) ?? null;
  const locusOf = (a: Assignment) => data.loci.find((l) => l.id === a.locusId);
  const locusIndex = current ? activeLoci.findIndex((l) => l.id === current.locusId) : -1;

  const next = useCallback(
    (last: string | null) => {
      setShown(false);
      const n = cue === "due" ? duePool.find((a) => a.id !== last) ?? null : pickNext(activeAssignments, last);
      setCurrentId(n?.id ?? null);
    },
    [cue, duePool, activeAssignments],
  );

  // Start/restart when cue type changes.
  useEffect(() => {
    next(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue]);

  const onGrade = useCallback(
    (g: Grade) => {
      if (!current) return;
      void grade(current.id, g, "drill");
      setSession((s) => ({ n: s.n + 1, correct: s.correct + (g >= 2 ? 1 : 0) }));
      next(current.id);
    },
    [current, grade, next],
  );

  useKeys(
    useCallback(
      (k: string) => {
        if (!current) return;
        if ((k === " " || k === "Enter") && !shown) setShown(true);
        else if (shown && ["1", "2", "3", "4"].includes(k)) onGrade((Number(k) - 1) as Grade);
      },
      [current, shown, onGrade],
    ),
  );

  const tabs: { id: Cue; label: string; pro?: boolean }[] = [
    { id: "locus", label: "Random locus" },
    { id: "card", label: "Random card" },
    { id: "due", label: `Due (${duePool.length})`, pro: true },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle title="Drill" subtitle="Random cues, out of order. Weak cards come up more often." />
      <div className="flex gap-1 rounded-xl bg-ink-800 p-1 text-sm font-semibold">
        {tabs.map((t) =>
          t.pro && !isPro ? (
            <Link key={t.id} href="?upgrade=1" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-slate-400 opacity-60">
              {t.label}<span className="pro-badge">Pro</span>
            </Link>
          ) : (
            <button key={t.id} onClick={() => setCue(t.id)} className={`flex flex-1 items-center justify-center rounded-lg px-2 py-2 ${cue === t.id ? "bg-ink-600 text-white" : "text-slate-400"}`}>
              {t.label}
            </button>
          ),
        )}
      </div>
      {session.n > 0 && <p className="text-center text-xs text-slate-500">This session: {session.correct}/{session.n} correct</p>}

      {!pool.length ? (
        cue === "due" ? (
          <Empty title="Nothing due 🎉" body="Every card is scheduled for later. Come back tomorrow or drill randomly." />
        ) : (
          <Empty title="Nothing to drill yet" body="Place some cards on your path first." href="/app/add" cta="Add a card" />
        )
      ) : current ? (
        <div className="panel flash-in space-y-4" key={current.id + session.n}>
          {cue === "locus" ? (
            <div className="py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Locus {locusIndex + 1}</p>
              <p className="text-4xl font-extrabold text-straw-300">{locusOf(current)?.name}</p>
              <p className="mt-2 text-sm text-slate-400">Which card lives here, and what does it do?</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-40"><CardImage card={current.card} hideText /></div>
              <p className="font-bold">{current.card.name}</p>
              <p className="text-sm text-slate-400">Where is it on your path, and what does it do?</p>
            </div>
          )}

          {shown ? (
            <div className="flash-in space-y-3">
              {cue === "locus" ? (
                <div className="flex gap-3">
                  <div className="w-20 shrink-0"><CardImage card={current.card} hideText /></div>
                  <div><p className="font-bold">{current.card.name}</p><p className="mt-1 text-sm italic text-straw-200/90">“{current.image}”</p></div>
                </div>
              ) : (
                <p className="text-sm"><span className="text-slate-500">At the</span> <b className="text-straw-300">{locusOf(current)?.name}</b>: <span className="italic text-straw-200/90">“{current.image}”</span></p>
              )}
              <div className="space-y-2 rounded-xl bg-ink-900 p-3"><CardMeta card={current.card} /><EffectText text={current.card.effect} /></div>
              <GradeButtons onGrade={onGrade} />
            </div>
          ) : (
            <button className="btn-primary w-full py-3" onClick={() => setShown(true)}>Show answer</button>
          )}
        </div>
      ) : null}
      <p className="hidden text-center text-xs text-slate-500 sm:block">Space: show answer · 1–4: grade</p>
    </div>
  );
}

export default function DrillPage() {
  return <Suspense><DrillInner /></Suspense>;
}
