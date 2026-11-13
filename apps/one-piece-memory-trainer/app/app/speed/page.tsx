"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { Empty, PageTitle, shuffle } from "@/components/ui";
import { CardImage, EffectText } from "@/components/CardView";
import { recallScore } from "@/lib/match";
import type { Assignment, Grade } from "@/lib/types";

const FLASH_MS = 2000;
type Phase = "setup" | "flash" | "answer" | "feedback" | "done";
type AnswerMode = "choice" | "type";

interface Result { a: Assignment; correct: boolean; ms: number }

export default function SpeedPage() {
  const { activeAssignments, grade } = useWorkspace();
  const distinctEffects = useMemo(() => new Set(activeAssignments.map((a) => a.card.effect)).size, [activeAssignments]);
  const canChoose = distinctEffects >= 4;
  const [answerMode, setAnswerMode] = useState<AnswerMode>("choice");
  const [roundSize, setRoundSize] = useState(10);
  const [queue, setQueue] = useState<Assignment[]>([]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>("setup");
  const [options, setOptions] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const askedAt = useRef(0);
  const current = queue[i];
  const mode: AnswerMode = canChoose ? answerMode : "type";

  function start() {
    // Repeat shuffled passes over the path until the round is full.
    const q: Assignment[] = [];
    while (q.length < roundSize) q.push(...shuffle(activeAssignments));
    const round = q.slice(0, roundSize);
    setQueue(round);
    setResults([]);
    setI(0);
    flash(round[0]);
  }

  function flash(a: Assignment | undefined) {
    if (!a) return setPhase("done");
    setTyped("");
    setPicked(null);
    const others = shuffle([...new Set(activeAssignments.filter((x) => x.card.effect !== a.card.effect).map((x) => x.card.effect))]).slice(0, 3);
    setOptions(shuffle([a.card.effect, ...others]));
    setPhase("flash");
  }

  useEffect(() => {
    if (phase !== "flash") return;
    const t = setTimeout(() => {
      askedAt.current = performance.now();
      setPhase("answer");
    }, FLASH_MS);
    return () => clearTimeout(t);
  }, [phase, i]);

  function submit(answer: string) {
    if (!current || phase !== "answer") return;
    const ms = performance.now() - askedAt.current;
    const correct = mode === "choice" ? answer === current.card.effect : recallScore(answer, current.card.effect) >= 0.5;
    const g: Grade = !correct ? 0 : ms < 4000 ? 3 : 2;
    void grade(current.id, g, "speed");
    setPicked(answer);
    setResults((r) => [...r, { a: current, correct, ms }]);
    setPhase("feedback");
  }

  function nextCard() {
    const n = i + 1;
    setI(n);
    if (n >= queue.length) setPhase("done");
    else flash(queue[n]);
  }

  if (!activeAssignments.length) return <><PageTitle title="Speed" /><Empty title="Nothing to flash yet" body="Place some cards on your path first." href="/app/add" cta="Add a card" /></>;

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageTitle title="Speed" subtitle="Each card flashes for 2 seconds. Then name its effect — fast." />
        <div className="panel space-y-4">
          <div>
            <p className="label">Answer by</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${mode === "choice" ? "bg-straw-400 text-ink-950" : "bg-ink-700"}`} disabled={!canChoose} onClick={() => setAnswerMode("choice")}>Multiple choice</button>
              <button className={`btn ${mode === "type" ? "bg-straw-400 text-ink-950" : "bg-ink-700"}`} onClick={() => setAnswerMode("type")}>Type it</button>
            </div>
            {!canChoose && <p className="mt-1.5 text-xs text-slate-500">Multiple choice unlocks with 4+ cards with different effects on this path.</p>}
          </div>
          <div>
            <p className="label">Round length</p>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20].map((n) => <button key={n} className={`btn ${roundSize === n ? "bg-straw-400 text-ink-950" : "bg-ink-700"}`} onClick={() => setRoundSize(n)}>{n} cards</button>)}
            </div>
          </div>
          <button className="btn-primary w-full py-3 text-base" onClick={start}>Start ⚡</button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    const avg = results.length ? results.reduce((s, r) => s + r.ms, 0) / results.length / 1000 : 0;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageTitle title="Round complete" />
        <div className="grid grid-cols-2 gap-3">
          <div className="panel text-center"><p className="text-4xl font-extrabold text-straw-400">{correct}/{results.length}</p><p className="text-xs text-slate-500">correct</p></div>
          <div className="panel text-center"><p className="text-4xl font-extrabold">{avg.toFixed(1)}s</p><p className="text-xs text-slate-500">avg answer time</p></div>
        </div>
        <ul className="panel space-y-1.5 text-sm">
          {results.map((r, k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={r.correct ? "text-emerald-400" : "text-blood-400"}>{r.correct ? "✓" : "✗"}</span>
              <span className="flex-1 truncate">{r.a.card.name}</span>
              <span className="tabular-nums text-xs text-slate-500">{(r.ms / 1000).toFixed(1)}s</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={start}>Play again</button>
          <button className="btn-ghost flex-1" onClick={() => setPhase("setup")}>Settings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Card {i + 1}/{queue.length}</span>
        <span>{results.filter((r) => r.correct).length} correct</span>
      </div>

      {phase === "flash" && current && (
        <div className="panel flash-in space-y-3" key={`f${i}`}>
          <div className="h-1 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full bg-straw-400" style={{ animation: `shrink ${FLASH_MS}ms linear forwards` }} />
          </div>
          <div className="mx-auto w-56"><CardImage card={current.card} hideText /></div>
          <p className="text-center font-bold">{current.card.name}</p>
        </div>
      )}

      {(phase === "answer" || phase === "feedback") && current && (
        <div className="panel flash-in space-y-3" key={`a${i}`}>
          <p className="text-center text-sm text-slate-400">What does <b className="text-white">{current.card.name}</b> do?</p>
          {mode === "choice" ? (
            <div className="space-y-2">
              {options.map((o, k) => {
                const isRight = o === current.card.effect;
                const cls =
                  phase === "feedback"
                    ? isRight ? "border-emerald-400 bg-emerald-400/10" : o === picked ? "border-blood-400 bg-blood-500/10" : "border-white/5 opacity-50"
                    : "border-white/10 hover:border-straw-400/60";
                return (
                  <button key={k} disabled={phase === "feedback"} onClick={() => submit(o)} className={`w-full rounded-xl border bg-ink-900 p-3 text-left text-sm transition ${cls}`}>
                    <span className="whitespace-pre-line">{o || "(No effect — vanilla)"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit(typed); }} className="space-y-2">
              <textarea autoFocus disabled={phase === "feedback"} className="input min-h-[90px]" placeholder="e.g. on play draw 2 trash 1" value={typed} onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(typed); } }} />
              {phase === "answer" && <button className="btn-primary w-full">Submit (Enter)</button>}
            </form>
          )}

          {phase === "feedback" && (
            <div className="space-y-3">
              {mode === "type" && (
                <div className="rounded-xl bg-ink-900 p-3">
                  <p className={`mb-1 text-sm font-bold ${results[results.length - 1]?.correct ? "text-emerald-400" : "text-blood-400"}`}>
                    {results[results.length - 1]?.correct ? "Correct!" : "Not quite."} ({Math.round(recallScore(typed, current.card.effect) * 100)}% of key terms)
                  </p>
                  <EffectText text={current.card.effect} />
                </div>
              )}
              <p className="text-xs italic text-straw-200/80">Your image: “{current.image}”</p>
              <button autoFocus className="btn-primary w-full" onClick={nextCard}>{i + 1 >= queue.length ? "See results" : "Next card →"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
