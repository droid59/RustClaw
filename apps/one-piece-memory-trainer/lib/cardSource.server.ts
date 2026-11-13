import "server-only";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEMO_CARDS, normalizeCardList } from "./cards";
import type { Card } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000; // refresh daily
const TMP_CACHE = path.join(os.tmpdir(), "opmt-cards-cache.json");
const SNAPSHOT = path.join(process.cwd(), "data", "cards.snapshot.json");

export interface CardCatalog {
  cards: Card[];
  source: "live" | "cache" | "snapshot" | "demo";
  fetchedAt: string;
}

let memory: { catalog: CardCatalog; loadedAt: number } | null = null;
let inflight: Promise<CardCatalog> | null = null;

function sources(): string[] {
  return [process.env.CARD_API_URL ?? "https://optcgapi.com/api/allSetCards/", process.env.CARD_API_ST_URL ?? "https://optcgapi.com/api/allSTCards/"].filter(Boolean);
}

async function fetchLive(): Promise<Card[]> {
  const lists = await Promise.all(
    sources().map(async (url) => {
      const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return res.json();
    }),
  );
  const cards = normalizeCardList(lists.flatMap((l) => (Array.isArray(l) ? l : Array.isArray(l?.data) ? l.data : [])));
  if (!cards.length) throw new Error("Card API returned no cards");
  return cards;
}

async function readJson(file: string): Promise<CardCatalog | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (Array.isArray(parsed?.cards) && parsed.cards.length) return parsed as CardCatalog;
  } catch {
    /* missing or unreadable */
  }
  return null;
}

async function refresh(): Promise<CardCatalog> {
  const disk = await readJson(TMP_CACHE);
  if (disk && Date.now() - new Date(disk.fetchedAt).getTime() < TTL_MS) return { ...disk, source: "cache" };
  try {
    const catalog: CardCatalog = { cards: await fetchLive(), source: "live", fetchedAt: new Date().toISOString() };
    await fs.writeFile(TMP_CACHE, JSON.stringify(catalog)).catch(() => undefined);
    return catalog;
  } catch (e) {
    console.warn("[cards] live fetch failed:", (e as Error).message);
    if (disk) return { ...disk, source: "cache" }; // stale beats nothing
    const snap = await readJson(SNAPSHOT);
    if (snap) return { ...snap, source: "snapshot" };
    return { cards: DEMO_CARDS, source: "demo", fetchedAt: new Date().toISOString() };
  }
}

/**
 * Card catalogue, cached in memory + tmp disk and refreshed every 24h.
 * When only fallback data (snapshot/demo) is available, live is retried every 10 minutes.
 */
export async function getCatalog(): Promise<CardCatalog> {
  if (memory) {
    const ttl = memory.catalog.source === "live" || memory.catalog.source === "cache" ? TTL_MS : 10 * 60 * 1000;
    if (Date.now() - memory.loadedAt < ttl) return memory.catalog;
  }
  inflight ??= refresh().finally(() => (inflight = null));
  const catalog = await inflight;
  memory = { catalog, loadedAt: Date.now() };
  return catalog;
}
