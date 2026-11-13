import type { Card } from "./types";

type Raw = Record<string, unknown>;

function pick(raw: Raw, ...keys: string[]): unknown {
  for (const k of keys) {
    const parts = k.split(".");
    let v: unknown = raw;
    for (const p of parts) v = v && typeof v === "object" ? (v as Raw)[p] : undefined;
    if (v !== undefined && v !== null && v !== "" && v !== "NULL" && v !== "null" && v !== "-") return v;
  }
  return undefined;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(" / ");
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null;
}

/** Normalise effect text: unify line breaks and collapse whitespace. */
export function cleanEffect(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Converts a card record from optcgapi.com (or apitcg-style / other community
 * databases) into our Card shape. Returns null for records without a code or name.
 */
export function normalizeCard(raw: Raw): Card | null {
  const code = str(pick(raw, "card_set_id", "code", "id", "cardId", "card_id", "number"));
  const name = str(pick(raw, "card_name", "name", "title"));
  if (!code || !name) return null;
  const image = str(pick(raw, "card_image", "images.large", "images.small", "image", "image_url", "imageUrl", "img")) || null;
  return {
    id: code,
    code,
    name,
    effect: cleanEffect(str(pick(raw, "card_text", "ability", "effect", "text", "effect_text"))),
    cost: num(pick(raw, "card_cost", "cost", "life")),
    power: num(pick(raw, "card_power", "power")),
    counter: num(pick(raw, "counter_amount", "counter")),
    color: str(pick(raw, "card_color", "color", "colors")),
    type: str(pick(raw, "card_type", "type", "category")),
    set: str(pick(raw, "set_name", "set.name", "set", "set_id")),
    rarity: str(pick(raw, "rarity")),
    image: image && /^https?:\/\//.test(image) ? image : null,
    source: "online",
  };
}

/**
 * Normalises a list and removes alternate-art duplicates. When a database lists
 * several printings of one code, the base printing (image id === code) wins.
 */
export function normalizeCardList(list: unknown): Card[] {
  const arr: Raw[] = Array.isArray(list)
    ? (list as Raw[])
    : list && typeof list === "object" && Array.isArray((list as Raw).data)
      ? ((list as Raw).data as Raw[])
      : [];
  const byCode = new Map<string, { card: Card; base: boolean }>();
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const card = normalizeCard(raw);
    if (!card) continue;
    const imageId = str(pick(raw, "card_image_id"));
    const base = !imageId || imageId === card.code;
    const existing = byCode.get(card.code);
    if (!existing || (!existing.base && base) || (!existing.card.effect && card.effect)) {
      byCode.set(card.code, { card, base });
    }
  }
  return [...byCode.values()].map((v) => v.card).sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
}

export interface CardQuery {
  q?: string;
  color?: string;
  set?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export function searchCards(cards: Card[], query: CardQuery): { total: number; results: Card[] } {
  const q = (query.q ?? "").trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const filtered = cards.filter((c) => {
    if (query.color && !c.color.toLowerCase().includes(query.color.toLowerCase())) return false;
    if (query.type && c.type.toLowerCase() !== query.type.toLowerCase()) return false;
    if (query.set && !c.code.toLowerCase().startsWith(query.set.toLowerCase())) return false;
    if (!terms.length) return true;
    const hay = `${c.code} ${c.name} ${c.effect} ${c.type} ${c.color}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  // Rank exact code / name-prefix matches first.
  if (q) {
    const score = (c: Card) => (c.code.toLowerCase() === q ? 0 : c.name.toLowerCase().startsWith(q) ? 1 : c.name.toLowerCase().includes(q) ? 2 : 3);
    filtered.sort((a, b) => score(a) - score(b));
  }
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(200, Math.max(1, query.limit ?? 48));
  return { total: filtered.length, results: filtered.slice(offset, offset + limit) };
}

/**
 * Fictional sample cards (clearly labelled "Demo") so the app is usable offline
 * and in tests. These are NOT official cards.
 */
export const DEMO_CARDS: Card[] = [
  ["DEMO-001", "Demo: Straw-Hat Rookie", "[On Play] Draw 2 cards and trash 1 card from your hand.", 3, 4000, 1000, "Red", "CHARACTER"],
  ["DEMO-002", "Demo: Iron Wall Marine", "[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)", 4, 5000, 1000, "Blue", "CHARACTER"],
  ["DEMO-003", "Demo: Flame Fist Brother", "[Rush] (This card can attack on the turn in which it is played.)\n[When Attacking] Give up to 1 of your opponent's Characters -2000 power during this turn.", 5, 6000, null, "Red", "CHARACTER"],
  ["DEMO-004", "Demo: Navigator's Trick", "[Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle.\n[Trigger] Draw 1 card.", 1, null, null, "Green", "EVENT"],
  ["DEMO-005", "Demo: Swordsman of Three Blades", "[DON!! x1] [When Attacking] K.O. up to 1 of your opponent's Characters with a cost of 3 or less.", 5, 6000, 1000, "Green", "CHARACTER"],
  ["DEMO-006", "Demo: Sniper on the Hill", "[On Play] Look at 5 cards from the top of your deck; reveal up to 1 Character card and add it to your hand. Then, place the rest at the bottom of your deck in any order.", 2, 3000, 2000, "Yellow", "CHARACTER"],
  ["DEMO-007", "Demo: Ship's Cook", "[Activate: Main] [Once Per Turn] Return up to 1 of your opponent's Characters with a cost of 2 or less to the owner's hand.", 4, 5000, 1000, "Blue", "CHARACTER"],
  ["DEMO-008", "Demo: Doctor of the Crew", "[On K.O.] Add up to 1 card from the top of your Life cards to your hand.\n[Your Turn] This Character gains +1000 power.", 2, 3000, 2000, "Purple", "CHARACTER"],
].map(([code, name, effect, cost, power, counter, color, type]) => ({
  id: code as string,
  code: code as string,
  name: name as string,
  effect: effect as string,
  cost: cost as number,
  power: power as number | null,
  counter: counter as number | null,
  color: color as string,
  type: type as string,
  set: "Demo set (fictional)",
  rarity: "C",
  image: null,
  source: "demo" as const,
}));
