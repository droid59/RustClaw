import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Pricing } from "@/components/Pricing";

const STEPS = [
  { n: "1", title: "Build a path", body: "Pick a place you know by heart — your kitchen: Stove → Sink → Table → Fridge → Door. These are your loci, always walked in the same order." },
  { n: "2", title: "Turn each effect into a scene", body: "“[On Play] Draw 2” becomes the character exploding out of your oven while two hissing swans smack you in the face. Absurd, loud, emotional — that’s what sticks." },
  { n: "3", title: "Walk it, drill it, master it", body: "Walk the path to recall every effect in order, then drill random cues and 2-second speed flashes until recognition is instant at the table." },
];

const MODES = [
  { title: "Add", body: "Search the live card database or upload your own scans, accept a one-click vivid image, and drop it on a locus." },
  { title: "Review", body: "Walk your path in order. See the place, recall the scene, reveal the effect, grade yourself." },
  { title: "Drill", body: "Random locus or random card cue. Pro adds a spaced-repetition Due queue that schedules each card at the perfect moment." },
  { title: "Speed", body: "The card flashes for 2 seconds. Pick or type its effect before your opponent finishes their sentence." },
];

export default function Landing() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <a href="#method" className="hidden px-3 py-2 text-slate-300 hover:text-white sm:block">Method</a>
          <a href="#pricing" className="hidden px-3 py-2 text-slate-300 hover:text-white sm:block">Pricing</a>
          <Link href="/app" className="btn-primary btn-sm">Open app</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-straw-400/30 bg-straw-400/10 px-3 py-1 text-xs font-semibold text-straw-300">
              The memory-palace method, built for the One Piece Card Game
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Know every card effect <span className="text-straw-400">before</span> your opponent reads it.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              One Piece Memory Trainer applies the Bruno/Dicsone method — vivid images placed along a familiar path — so effects,
              triggers and power numbers stick in long-term memory instead of slipping away mid-match.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className="btn-primary px-6 py-3 text-base">Start training free</Link>
              <a href="#method" className="btn-ghost px-6 py-3 text-base">How it works</a>
            </div>
            <p className="mt-3 text-xs text-slate-500">No credit card. 1 path and 20 cards free forever.</p>
          </div>
          <div className="panel relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,210,87,0.18),transparent_60%)]" />
            <div className="relative space-y-3">
              <p className="label">Locus 1 · Stove</p>
              <div className="rounded-xl bg-ink-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Effect</p>
                <p className="mt-1 text-sm"><span className="rounded bg-straw-400/15 px-1 font-semibold text-straw-300">[On Play]</span> Draw 2 cards and trash 1 card from your hand.</p>
              </div>
              <div className="rounded-xl border border-straw-400/30 bg-straw-400/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-straw-400">Your vivid image</p>
                <p className="mt-1 text-sm leading-relaxed">
                  At the STOVE, the rookie EXPLODES out of the oven the instant it lands, screaming its own name; cards fire out like a jackpot — two
                  hissing swans smack you in the face; the smell of the overflowing rubbish bin is unbearable. <em>You gasp.</em>
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
                {["Again", "Hard", "Good", "Easy"].map((g, i) => (
                  <span key={g} className={`rounded-lg py-2 ${i === 2 ? "bg-straw-400 text-ink-950" : "bg-ink-700 text-slate-300"}`}>{g}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="border-y border-white/5 bg-ink-900/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">The method in three steps</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Your brain is terrible at remembering text and brilliant at remembering places and outrageous events. The Bruno/Dicsone
            approach exploits that: one familiar route, one exaggerated sensory image per card, rehearsed in order.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="panel">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-straw-400 font-extrabold text-ink-950">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 panel">
            <h3 className="font-bold">Numbers become objects</h3>
            <p className="mt-1 text-sm text-slate-400">
              Power and cost values use the number-shape system: 1 is a candle, 2 a swan, 3 handcuffs, 4 a sailboat, 5 a snake…
              “+2000 power” is two golden swans tattooed on a bicep. You will never mix up a 2k and a 4k counter again.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">Four training modes</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <div key={m.title} className="panel">
              <h3 className="font-bold text-straw-300">{m.title} mode</h3>
              <p className="mt-1 text-sm text-slate-400">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-white/5 bg-ink-900/60 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Simple pricing</h2>
          <p className="mb-10 mt-2 text-center text-slate-400">Learn the method free. Go Pro when you want the whole meta in your head.</p>
          <Pricing />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-slate-500">
        <p>
          One Piece Memory Trainer is an unofficial fan-made study tool. It is not produced, endorsed, supported or affiliated with Bandai,
          Toei Animation, Shueisha or Eiichiro Oda. Card names, text and images are trademarks/copyright of their respective owners and are
          displayed for reference only.
        </p>
      </footer>
    </main>
  );
}
