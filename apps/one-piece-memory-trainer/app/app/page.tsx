"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageTitle, ProLock, Stat } from "@/components/ui";
import { activity, dailyStreak, dueForecast, isMastered, locusStats, weakLoci } from "@/lib/stats";
import { isDue } from "@/lib/srs";
import { FREE_LIMITS } from "@/lib/plans";

export default function Dashboard() {
  const { data, profile, activeLoci, activeAssignments, activePath } = useWorkspace();
  const isPro = Boolean(profile?.isPro);
  const all = data.assignments;
  const mastered = all.filter(isMastered).length;
  const streak = dailyStreak(data.logs);
  const due = all.filter((a) => isDue(a.srs)).length;
  const weak = weakLoci(activeLoci, activeAssignments).filter((w) => w.accuracy! < 1);
  const perLocus = useMemo(() => locusStats(activeLoci, activeAssignments), [activeLoci, activeAssignments]);
  const act = useMemo(() => activity(data.logs, 30), [data.logs]);
  const forecast = useMemo(() => dueForecast(all, 7), [all]);
  const maxAct = Math.max(1, ...act.map((d) => d.count));
  const maxF = Math.max(1, ...forecast);
  const reviewedToday = act[act.length - 1]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Your memory palace"
        subtitle={reviewedToday ? `${reviewedToday} recalls today — keep the streak alive.` : "No reviews yet today. A 5-minute walk keeps the streak alive."}
        action={<Link href={isPro && due ? "/app/drill?mode=due" : "/app/review"} className="btn-primary">{isPro && due ? `Drill ${due} due` : "Walk the path"}</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cards placed" value={all.length} hint={isPro ? "Unlimited" : `${FREE_LIMITS.cards - all.length} left on Free`} />
        <Stat label="Mastered" value={mastered} hint="3 correct recalls in a row" accent />
        <Stat label="Daily streak" value={`${streak}🔥`} hint={streak ? "days in a row" : "Review today to start"} />
        <Stat label="Due now" value={isPro ? due : "—"} hint={isPro ? "Spaced repetition" : "Pro: SRS scheduling"} />
      </div>

      {all.length === 0 && (
        <div className="panel border-straw-400/30 bg-straw-400/5">
          <p className="font-bold">Start here</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>Check your path — the kitchen example is ready: Stove → Sink → Table → Fridge → Door. <Link className="text-straw-300 underline" href="/app/paths">Customise it</Link>.</li>
            <li><Link className="text-straw-300 underline" href="/app/add">Add a card</Link>, hit <b>Suggest image</b>, and drop it on a locus.</li>
            <li>Walk the path in <Link className="text-straw-300 underline" href="/app/review">Review</Link>, then hammer it in <Link className="text-straw-300 underline" href="/app/drill">Drill</Link>.</li>
          </ol>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel">
          <h2 className="font-bold">Weak loci</h2>
          <p className="text-xs text-slate-500">Lowest recall accuracy on “{activePath?.name}”. Re-imagine these scenes louder.</p>
          {weak.length ? (
            <ul className="mt-3 space-y-2">
              {weak.map((w) => (
                <li key={w.locus.id} className="flex items-center gap-3">
                  <span className="w-24 truncate text-sm font-semibold">{w.locus.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div className={`h-full rounded-full ${w.accuracy! < 0.6 ? "bg-blood-400" : w.accuracy! < 0.8 ? "bg-orange-300" : "bg-emerald-400"}`} style={{ width: `${Math.round(w.accuracy! * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums text-slate-400">{Math.round(w.accuracy! * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {activeAssignments.some((a) => a.stats.correct + a.stats.wrong > 0) ? "No weak spots — every place recalled perfectly so far." : "Drill a few cards to see which places need stronger images."}
            </p>
          )}
        </div>

        <div className="panel">
          <h2 className="font-bold">Path at a glance</h2>
          <ol className="mt-3 space-y-1.5">
            {perLocus.map((s, i) => (
              <li key={s.locus.id} className="flex items-center gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-bold">{i + 1}</span>
                <span className="flex-1 truncate">{s.locus.name}</span>
                <span className="text-xs text-slate-500">{s.cards} card{s.cards === 1 ? "" : "s"}</span>
                {s.mastered > 0 && <span className="chip bg-straw-400/15 text-straw-300">{s.mastered}★</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {isPro ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel">
            <h2 className="font-bold">30-day activity</h2>
            <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label="Reviews per day for the last 30 days">
              {act.map((d) => (
                <div key={d.day} title={`${d.day}: ${d.count} reviews, ${d.correct} correct`} className="flex-1 rounded-t bg-sea-500/70" style={{ height: `${(d.count / maxAct) * 100}%`, minHeight: d.count ? 3 : 1, opacity: d.count ? 1 : 0.2 }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{act[0]?.day}</span><span>today</span></div>
          </div>
          <div className="panel">
            <h2 className="font-bold">Due forecast</h2>
            <div className="mt-4 flex h-28 items-end gap-2">
              {forecast.map((n, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-slate-400">{n}</span>
                  <div className="w-full rounded-t bg-straw-400/80" style={{ height: `${(n / maxF) * 80}%`, minHeight: n ? 3 : 1 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 text-center text-[10px] text-slate-500">{["Now", "+1d", "+2d", "+3d", "+4d", "+5d", "+6d"].map((l) => <span key={l}>{l}</span>)}</div>
          </div>
          <div className="panel lg:col-span-2 overflow-x-auto">
            <h2 className="font-bold">Per-locus accuracy</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-1">Locus</th><th>Cards</th><th>Recalls</th><th>Accuracy</th><th>Mastered</th></tr>
              </thead>
              <tbody>
                {perLocus.map((s) => (
                  <tr key={s.locus.id} className="border-t border-white/5">
                    <td className="py-2 font-semibold">{s.locus.name}</td><td>{s.cards}</td><td>{s.attempts}</td>
                    <td>{s.accuracy === null ? "—" : `${Math.round(s.accuracy * 100)}%`}</td><td>{s.mastered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ProLock title="Full progress analytics">
          <div className="flex h-32 items-end gap-1">{Array.from({ length: 30 }, (_, i) => <div key={i} className="flex-1 rounded-t bg-sea-500" style={{ height: `${20 + ((i * 37) % 80)}%` }} />)}</div>
        </ProLock>
      )}
    </div>
  );
}
