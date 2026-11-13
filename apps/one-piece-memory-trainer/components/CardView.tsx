"use client";

import type { Card } from "@/lib/types";

const COLOR_CLASS: Record<string, string> = {
  red: "from-red-500/40", blue: "from-sky-500/40", green: "from-emerald-500/40",
  purple: "from-violet-500/40", black: "from-slate-400/30", yellow: "from-yellow-400/40",
};

function gradient(color: string) {
  const first = color.toLowerCase().split(/[\s/]+/)[0];
  return COLOR_CLASS[first] ?? "from-ink-600";
}

/** Card art, or a styled placeholder for cards without an image. */
export function CardImage({ card, className = "", hideText = false }: { card: Card; className?: string; hideText?: boolean }) {
  if (card.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.image} alt={card.name} loading="lazy" className={`aspect-[63/88] w-full rounded-xl bg-ink-900 object-cover ${className}`} />;
  }
  return (
    <div className={`flex aspect-[63/88] w-full flex-col justify-between rounded-xl border border-white/10 bg-gradient-to-b ${gradient(card.color)} to-ink-900 p-3 ${className}`}>
      <div className="flex items-start justify-between text-xs font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-950/70">{card.cost ?? "–"}</span>
        <span className="rounded bg-ink-950/70 px-1.5 py-0.5">{card.power ?? ""}</span>
      </div>
      <div>
        <p className="text-sm font-extrabold leading-tight">{card.name}</p>
        {!hideText && <p className="mt-1 line-clamp-4 text-[10px] leading-snug text-slate-300">{card.effect || "No effect"}</p>}
        <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-400">{card.code}</p>
      </div>
    </div>
  );
}

export function CardMeta({ card }: { card: Card }) {
  const items = [
    card.code,
    card.type,
    card.color,
    card.cost !== null ? `Cost ${card.cost}` : null,
    card.power !== null ? `Power ${card.power}` : null,
    card.counter ? `Counter +${card.counter}` : null,
    card.source === "upload" ? "Uploaded" : card.source === "demo" ? "Demo" : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="chip">{i}</span>
      ))}
    </div>
  );
}

export function EffectText({ text }: { text: string }) {
  if (!text) return <p className="effect italic text-slate-500">No effect text (vanilla card).</p>;
  // Highlight [Keyword] timings.
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <p className="effect">
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="mr-0.5 rounded bg-straw-400/15 px-1 font-semibold text-straw-300">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}
