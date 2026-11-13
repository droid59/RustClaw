import { describe, expect, it } from "vitest";
import { normalizeCardList, searchCards, DEMO_CARDS, cleanEffect } from "@/lib/cards";
import { newSrs, schedule, isDue } from "@/lib/srs";
import { suggestImage, numberImage } from "@/lib/suggest";
import { recallScore, isRecallCorrect } from "@/lib/match";
import { dailyStreak, weakLoci, dueForecast } from "@/lib/stats";
import { assertCanAddCard, assertCanAddPath, UpgradeRequiredError } from "@/lib/plans";
import type { Assignment, Locus, ReviewLog } from "@/lib/types";

describe("card normalisation", () => {
  it("normalises optcgapi records and prefers base printings", () => {
    const raw = [
      { card_set_id: "OP01-001", card_name: "Alt", card_image_id: "OP01-001_p1", card_text: "[On Play] Draw 1 card.", card_cost: "NULL", card_power: "5000", card_image: "https://x/p1.jpg" },
      { card_set_id: "OP01-001", card_name: "Base", card_image_id: "OP01-001", card_text: "[On Play] Draw 1 card.<br>[Trigger] x", card_cost: "3", card_power: "5000", counter_amount: "1000", card_color: "Red", card_type: "Character", set_name: "Romance Dawn", card_image: "https://x/base.jpg" },
      { card_set_id: "OP01-002", card_name: "Other", card_text: "NULL", card_power: "4000" },
      { foo: "bar" },
    ];
    const cards = normalizeCardList(raw);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ code: "OP01-001", name: "Base", cost: 3, power: 5000, counter: 1000, image: "https://x/base.jpg" });
    expect(cards[0].effect).toBe("[On Play] Draw 1 card.\n[Trigger] x");
    expect(cards[1].effect).toBe("");
    expect(cards[1].cost).toBeNull();
  });

  it("accepts apitcg-style { data: [...] } payloads", () => {
    const cards = normalizeCardList({ data: [{ code: "ST01-001", name: "Leader", ability: "Your Turn", images: { large: "https://y/l.png" }, set: { name: "Starter" } }] });
    expect(cards[0]).toMatchObject({ code: "ST01-001", image: "https://y/l.png", set: "Starter" });
  });

  it("searches by name, code and effect", () => {
    expect(searchCards(DEMO_CARDS, { q: "blocker" }).results.map((c) => c.code)).toEqual(["DEMO-002"]);
    expect(searchCards(DEMO_CARDS, { q: "demo-005" }).results[0].code).toBe("DEMO-005");
    expect(searchCards(DEMO_CARDS, { color: "red" }).total).toBe(2);
    expect(cleanEffect("a<br/>b")).toBe("a\nb");
  });
});

describe("spaced repetition", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("grows intervals on success and resets on failure", () => {
    let s = newSrs(now);
    expect(isDue(s, now)).toBe(true);
    s = schedule(s, 2, now);
    expect(s.interval).toBe(1);
    s = schedule(s, 2, now);
    expect(s.interval).toBe(6);
    s = schedule(s, 3, now);
    expect(s.interval).toBeGreaterThan(15);
    s = schedule(s, 0, now);
    expect(s.reps).toBe(0);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    expect(isDue(s, new Date(now.getTime() + 11 * 60 * 1000))).toBe(true);
  });
});

describe("image suggestion", () => {
  it("builds a vivid, locus-anchored image with number shapes", () => {
    const s = suggestImage({ name: "Demo: Straw-Hat Rookie", effect: "[On Play] Draw 2 cards and trash 1 card from your hand.", locus: "Stove" });
    expect(s.text.startsWith("At the STOVE, STRAW-HAT ROOKIE")).toBe(true);
    expect(s.tags).toEqual(expect.arrayContaining(["On Play", "Draw", "Trash"]));
    expect(s.text).toContain("hissing swan");
  });
  it("is deterministic per variant and varies across variants", () => {
    const input = { name: "X", effect: "[Blocker]" };
    expect(suggestImage(input, 0).text).toBe(suggestImage(input, 0).text);
    expect(suggestImage(input, 0).text).not.toBe(suggestImage(input, 1).text);
  });
  it("handles vanilla cards", () => {
    expect(suggestImage({ name: "Big Guy", effect: "", power: 7000 }).tags).toEqual(["Vanilla"]);
    expect(numberImage(2000)).toContain("swan");
  });
});

describe("recall matching", () => {
  it("scores key-term coverage", () => {
    const effect = "[On Play] Draw 2 cards.";
    expect(isRecallCorrect("on play draw 2", effect)).toBe(true);
    expect(recallScore("blocker", effect)).toBe(0);
  });
});

describe("stats", () => {
  const loci: Locus[] = [
    { id: "l1", pathId: "p", name: "Stove", position: 0 },
    { id: "l2", pathId: "p", name: "Sink", position: 1 },
  ];
  const mk = (locusId: string, correct: number, wrong: number, due: string): Assignment => ({
    id: locusId + correct, pathId: "p", locusId, card: DEMO_CARDS[0], image: "", createdAt: "",
    srs: { ...newSrs(), due }, stats: { correct, wrong, streak: 0 },
  });
  it("finds the weakest locus", () => {
    const w = weakLoci(loci, [mk("l1", 9, 1, "2026-01-01"), mk("l2", 1, 3, "2026-01-01")]);
    expect(w[0].locus.name).toBe("Sink");
  });
  it("counts daily streaks", () => {
    const now = new Date(2026, 0, 10, 12);
    const log = (d: number): ReviewLog => ({ id: String(d), assignmentId: "a", locusId: "l1", grade: 2, mode: "drill", at: new Date(2026, 0, d, 9).toISOString() });
    expect(dailyStreak([log(10), log(9), log(8), log(6)], now)).toBe(3);
    expect(dailyStreak([log(9), log(8)], now)).toBe(2);
    expect(dailyStreak([log(7)], now)).toBe(0);
  });
  it("forecasts due cards", () => {
    const now = new Date(2026, 0, 10, 12);
    const f = dueForecast([mk("l1", 0, 0, new Date(2026, 0, 1).toISOString()), mk("l1", 1, 0, new Date(2026, 0, 12, 8).toISOString())], 7, now);
    expect(f[0]).toBe(1);
    expect(f[2]).toBe(1);
  });
});

describe("plan limits", () => {
  it("enforces free tier limits", () => {
    expect(() => assertCanAddPath(false, 1)).toThrow(UpgradeRequiredError);
    expect(() => assertCanAddPath(true, 50)).not.toThrow();
    expect(() => assertCanAddCard(false, 19)).not.toThrow();
    expect(() => assertCanAddCard(false, 20)).toThrow(/20 cards/);
  });
});

import { exportWorkspace, parseWorkspaceExport } from "@/lib/portable";

describe("export / import", () => {
  it("round-trips with fresh ids and intact references", () => {
    const data = {
      paths: [{ id: "p1", name: "Kitchen", createdAt: "" }],
      loci: [{ id: "l1", pathId: "p1", name: "Stove", position: 0 }],
      assignments: [{ id: "a1", pathId: "p1", locusId: "l1", card: DEMO_CARDS[0], image: "x", createdAt: "", srs: newSrs(), stats: { correct: 1, wrong: 0, streak: 1 } }],
      userCards: [],
      logs: [
        { id: "g1", assignmentId: "a1", locusId: "l1", grade: 2 as const, mode: "drill" as const, at: "" },
        { id: "g2", assignmentId: "gone", locusId: "l1", grade: 2 as const, mode: "drill" as const, at: "" },
      ],
    };
    const back = parseWorkspaceExport(exportWorkspace(data));
    expect(back.paths[0].id).not.toBe("p1");
    expect(back.loci[0].pathId).toBe(back.paths[0].id);
    expect(back.assignments[0].locusId).toBe(back.loci[0].id);
    expect(back.logs).toHaveLength(1);
    expect(back.logs[0].assignmentId).toBe(back.assignments[0].id);
  });
  it("rejects foreign or broken files", () => {
    expect(() => parseWorkspaceExport("nope")).toThrow(/valid JSON/);
    expect(() => parseWorkspaceExport('{"app":"other","data":{}}')).toThrow(/not a One Piece/);
    const broken = { app: "one-piece-memory-trainer", data: { paths: [], loci: [{ id: "l", name: "x", pathId: "missing" }], assignments: [], userCards: [], logs: [] } };
    expect(() => parseWorkspaceExport(JSON.stringify(broken))).toThrow(/missing path/);
  });
});
