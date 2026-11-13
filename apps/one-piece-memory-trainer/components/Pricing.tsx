import Link from "next/link";
import { FREE_LIMITS, PLAN_FEATURES } from "@/lib/plans";

export function Pricing({ cta = "/app" }: { cta?: string }) {
  const price = process.env.NEXT_PUBLIC_PRO_PRICE_LABEL || "$5/month";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel flex flex-col">
        <h3 className="text-lg font-bold">Free</h3>
        <p className="mt-1 text-3xl font-extrabold">$0</p>
        <p className="text-sm text-slate-400">
          {FREE_LIMITS.paths} path · {FREE_LIMITS.cards} cards — enough to master a starter deck’s key effects.
        </p>
        <ul className="mt-4 flex-1 space-y-2 text-sm">
          {PLAN_FEATURES.free.map((f) => (
            <li key={f} className="flex gap-2"><span className="text-sea-400">✓</span>{f}</li>
          ))}
        </ul>
        <Link href={cta} className="btn-ghost mt-6">Start free</Link>
      </div>
      <div className="panel relative flex flex-col border-straw-400/40 bg-gradient-to-b from-straw-400/10 to-ink-800">
        <span className="absolute -top-3 right-4 rounded-full bg-straw-400 px-3 py-1 text-xs font-bold text-ink-950">For competitive players</span>
        <h3 className="text-lg font-bold">Pro</h3>
        <p className="mt-1 text-3xl font-extrabold">{price}</p>
        <p className="text-sm text-slate-400">Memorise the whole meta. Cancel anytime.</p>
        <ul className="mt-4 flex-1 space-y-2 text-sm">
          {PLAN_FEATURES.pro.map((f) => (
            <li key={f} className="flex gap-2"><span className="text-straw-400">★</span>{f}</li>
          ))}
        </ul>
        <Link href={`${cta}${cta.includes("?") ? "&" : "?"}upgrade=1`} className="btn-primary mt-6">Go Pro</Link>
      </div>
    </div>
  );
}
