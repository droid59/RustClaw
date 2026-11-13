/**
 * Bruno/Dicsone-style image generator.
 *
 * The method: every piece of information becomes a short, absurd, emotional,
 * multi-sensory ACTION happening AT a familiar place (the locus). Numbers become
 * concrete objects (number-shape system) so "+2000 power" is something you can see.
 *
 * This is deterministic and works offline: same card + variant => same image,
 * "Suggest again" bumps the variant.
 */

/** Number-shape system: digits look like objects. */
export const NUMBER_SHAPES: Record<number, string> = {
  0: "a glowing donut",
  1: "a burning candle",
  2: "a hissing swan",
  3: "a pair of handcuffs",
  4: "a sailboat",
  5: "a coiled snake",
  6: "a golf club",
  7: "a cliff edge",
  8: "a snowman",
  9: "a balloon on a string",
  10: "a bat and ball",
};

export function numberImage(n: number): string {
  if (n in NUMBER_SHAPES) return NUMBER_SHAPES[n];
  if (n >= 1000 && n % 1000 === 0) {
    const k = n / 1000;
    return `${k in NUMBER_SHAPES ? NUMBER_SHAPES[k] : k} made of gold coins`;
  }
  return String(n);
}

interface Rule {
  test: RegExp;
  /** Variants: functions so they can use regex captures. */
  scenes: ((m: RegExpMatchArray) => string)[];
  /** Short keyword tag summarising the rule (shown as a hint). */
  tag: string;
}

const RULES: Rule[] = [
  { tag: "On Play", test: /\[On Play\]/i, scenes: [() => "the instant it lands it EXPLODES out of the box like a jack-in-the-box, screaming its own name", () => "it kicks the door down on arrival, confetti cannons firing"] },
  { tag: "When Attacking", test: /\[When Attacking\]/i, scenes: [() => "mid-charge it roars and swings a giant war-drum", () => "as it lunges forward its boots leave smoking footprints"] },
  { tag: "On K.O.", test: /\[On K\.?O\.?\]/i, scenes: [() => "as it collapses it throws one last gift over its shoulder", () => "its ghost floats up and drops something into your lap"] },
  { tag: "Blocker", test: /\[Blocker\]/i, scenes: [() => "it slams itself face-first in front of you like a human shield, teeth rattling", () => "it builds a brick wall in a heartbeat and hugs it"] },
  { tag: "Rush", test: /\[Rush\]/i, scenes: [() => "it sprints in still wet from the paint — no waiting, no warm-up", () => "it bursts through the wall at full speed, out of breath"] },
  { tag: "Counter", test: /\[Counter\]/i, scenes: [() => "a boxing glove springs out of nowhere and punches back", () => "a mirror flashes and the blow bounces straight back"] },
  { tag: "Trigger", test: /\[Trigger\]/i, scenes: [() => "a tripwire snaps and a hidden spring-trap fires", () => "a red mousetrap snaps on your finger — OUCH"] },
  { tag: "Activate: Main", test: /\[Activate: ?Main\]/i, scenes: [() => "you slap a huge red button on its chest", () => "you pull a heavy lever and gears grind"] },
  { tag: "Once Per Turn", test: /\[Once Per Turn\]/i, scenes: [() => "but a single egg-timer allows it only ONE go", () => "a strict referee holds up one finger"] },
  { tag: "DON!!", test: /\[DON!! ?x(\d+)\]/i, scenes: [(m) => `only after you feed it ${numberImage(Number(m[1]))} worth of golden DON!! coins`, (m) => `it refuses until ${numberImage(Number(m[1]))} lands in its tip jar`] },
  { tag: "Your Turn", test: /\[Your Turn\]/i, scenes: [() => "only while YOUR alarm clock is ringing", () => "only while the spotlight is on you"] },
  { tag: "Opponent's Turn", test: /\[Opponent'?s Turn\]/i, scenes: [() => "only while your rival's alarm clock is ringing", () => "only while the spotlight swings to your rival"] },
  { tag: "Draw", test: /draw (\d+) cards?/i, scenes: [(m) => `cards fire out of the slot like a jackpot — ${numberImage(Number(m[1]))} of them smack you in the face`, (m) => `you reel in a fishing line with ${numberImage(Number(m[1]))} hooked on it, cards dripping`] },
  { tag: "Look at top", test: /look at (\d+) cards? from the top/i, scenes: [(m) => `you peel back ${numberImage(Number(m[1]))}-many layers of an onion, eyes watering, hunting for the one you want`, (m) => `you peek through a keyhole and count ${numberImage(Number(m[1]))}`] },
  { tag: "K.O.", test: /K\.O\. up to (\d+)[^.]*?cost of (\d+) or less/i, scenes: [(m) => `it flicks ${numberImage(Number(m[1]))} into a tiny enemy (no bigger than ${numberImage(Number(m[2]))}) and it flies off screaming`, (m) => `a frying pan BONKS a small enemy, the size of ${numberImage(Number(m[2]))}, out cold`] },
  { tag: "K.O.", test: /K\.O\./i, scenes: [() => "a frying pan BONKS the enemy out cold — stars circling", () => "the enemy is launched into the sky, a twinkle on the horizon"] },
  { tag: "Bounce", test: /return[^.]*?to (?:the owner's|its owner's|their owner's) hand/i, scenes: [() => "a giant rubber boomerang sends the enemy flying back where it came from", () => "a tornado sucks the enemy up and spits it back into its owner's lap"] },
  { tag: "Rest", test: /\brest up to/i, scenes: [() => "it sprays sleeping gas and the enemy flops over snoring", () => "it sings a lullaby; the enemy yawns and lies down sideways"] },
  { tag: "Power up", test: /\+(\d+) power/i, scenes: [(m) => `muscles balloon until they rip the shirt — you see ${numberImage(Number(m[1]))} tattooed on the bicep`, (m) => `it gulps a fizzing potion and grows huge, holding ${numberImage(Number(m[1]))}`] },
  { tag: "Power down", test: /-(\d+) power/i, scenes: [(m) => `it pokes the enemy with a pin and they deflate, ${numberImage(Number(m[1]))} leaking out with a sad whistle`, (m) => `the enemy shrinks to doll-size, dropping ${numberImage(Number(m[1]))}`] },
  { tag: "Life", test: /\bLife\b/i, scenes: [() => "a beating red heart is ripped from the treasure chest", () => "your life-candles flicker and one jumps into your hand"] },
  { tag: "Trash", test: /\btrash\b/i, scenes: [() => "the smell of the overflowing rubbish bin is unbearable", () => "something gets dunked in a stinking trash can"] },
  { tag: "Add to hand", test: /add (?:it|up to \d+[^.]*?) to your hand/i, scenes: [() => "and the prize lands warm in your palm", () => "and you catch it with sticky fingers"] },
  { tag: "Play", test: /\bplay up to/i, scenes: [() => "a stage curtain rips open and a new crewmate cartwheels out", () => "a new crewmate pops out of a barrel, cheering"] },
  { tag: "Cost", test: /cost of (\d+) or less/i, scenes: [(m) => `but only on enemies no bigger than ${numberImage(Number(m[1]))}`, (m) => `but only on enemies wearing a price tag of ${numberImage(Number(m[1]))} or less`] },
];

const EMOTIONS = ["You gasp.", "You burst out laughing.", "Your heart pounds.", "You feel the heat on your skin.", "It smells of gunpowder and salt.", "Everything is SO loud.", "You can't believe your eyes."];

export interface SuggestInput {
  name: string;
  effect: string;
  locus?: string;
  power?: number | null;
  cost?: number | null;
}

export interface Suggestion {
  text: string;
  tags: string[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shortName(name: string): string {
  return name.replace(/^Demo:\s*/i, "").split(/[,(]/)[0].trim();
}

export function suggestImage(input: SuggestInput, variant = 0): Suggestion {
  const seed = hash(`${input.name}|${input.effect}`) + variant;
  const where = input.locus ? `At the ${input.locus.toUpperCase()}` : "Right in front of you";
  const who = shortName(input.name).toUpperCase();
  const effect = input.effect || "";

  const fragments: string[] = [];
  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const rule of RULES) {
    if (seenTags.has(rule.tag)) continue;
    const m = effect.match(rule.test);
    if (!m) continue;
    seenTags.add(rule.tag);
    tags.push(rule.tag);
    const scene = rule.scenes[(seed + fragments.length) % rule.scenes.length];
    fragments.push(scene(m));
    if (fragments.length >= 4) break;
  }

  if (!fragments.length) {
    if (!effect.trim()) {
      const p = input.power ? ` flexing ${numberImage(input.power)}` : "";
      fragments.push(`stands there${p}, absurdly huge, blocking the whole room`);
      tags.push("Vanilla");
    } else {
      // Unknown wording: anchor on the most distinctive words.
      const words = effect.replace(/[\[\]().,]/g, " ").split(/\s+/).filter((w) => w.length > 5).slice(0, 3);
      fragments.push(`writes "${words.join(" ") || effect.slice(0, 30)}" in giant glowing letters across everything`);
      tags.push("Custom");
    }
  }

  const emotion = EMOTIONS[seed % EMOTIONS.length];
  const text = `${where}, ${who} — ${fragments.join("; ")}. ${emotion}`;
  return { text: text.replace(/\s+/g, " ").trim(), tags };
}
