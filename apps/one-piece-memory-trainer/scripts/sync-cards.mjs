#!/usr/bin/env node
// Downloads the full card list and writes data/cards.snapshot.json.
// The snapshot is the offline fallback used when the live API is unreachable.
// Usage: npm run cards:sync   (respects CARD_API_URL / CARD_API_ST_URL)
import { writeFile, mkdir } from "node:fs/promises";

const urls = [
  process.env.CARD_API_URL ?? "https://optcgapi.com/api/allSetCards/",
  process.env.CARD_API_ST_URL ?? "https://optcgapi.com/api/allSTCards/",
];

const raw = [];
for (const url of urls) {
  process.stdout.write(`Fetching ${url} ... `);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.data ?? [];
  raw.push(...list);
  console.log(`${list.length} records`);
}

// Minimal re-implementation of lib/cards.ts normalizeCardList (kept dependency-free).
const val = (r, ...keys) => {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o && typeof o === "object" ? o[p] : undefined), r);
    if (v !== undefined && v !== null && v !== "" && v !== "NULL" && v !== "null" && v !== "-") return v;
  }
};
const s = (v) => (v == null ? "" : String(v).trim());
const n = (v) => (v == null || !/\d/.test(String(v)) ? null : Number(String(v).replace(/[^0-9.-]/g, "")));
const clean = (t) => t.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();

const byCode = new Map();
for (const r of raw) {
  const code = s(val(r, "card_set_id", "code", "id"));
  const name = s(val(r, "card_name", "name"));
  if (!code || !name) continue;
  const imageId = s(val(r, "card_image_id"));
  const base = !imageId || imageId === code;
  const image = s(val(r, "card_image", "images.large", "images.small", "image"));
  const card = {
    id: code, code, name,
    effect: clean(s(val(r, "card_text", "ability", "effect", "text"))),
    cost: n(val(r, "card_cost", "cost", "life")),
    power: n(val(r, "card_power", "power")),
    counter: n(val(r, "counter_amount", "counter")),
    color: s(val(r, "card_color", "color")),
    type: s(val(r, "card_type", "type")),
    set: s(val(r, "set_name", "set.name", "set")),
    rarity: s(val(r, "rarity")),
    image: /^https?:\/\//.test(image) ? image : null,
    source: "online",
  };
  const prev = byCode.get(code);
  if (!prev || (!prev.base && base)) byCode.set(code, { card, base });
}
const cards = [...byCode.values()].map((v) => v.card).sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/cards.snapshot.json", import.meta.url), JSON.stringify({ cards, source: "snapshot", fetchedAt: new Date().toISOString() }));
console.log(`Wrote ${cards.length} cards to data/cards.snapshot.json`);
