import type { Assignment, Locus, ReviewLog } from "./types";

export const MASTERY_STREAK = 3;

export function isMastered(a: Assignment): boolean {
  return a.stats.streak >= MASTERY_STREAK;
}

export function dayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive days with at least one review, ending today (or yesterday, if today has none yet). */
export function dailyStreak(logs: ReviewLog[], now = new Date()): number {
  const days = new Set(logs.map((l) => dayKey(l.at)));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface LocusStat {
  locus: Locus;
  cards: number;
  attempts: number;
  accuracy: number | null;
  mastered: number;
}

export function locusStats(loci: Locus[], assignments: Assignment[]): LocusStat[] {
  return loci.map((locus) => {
    const here = assignments.filter((a) => a.locusId === locus.id);
    const correct = here.reduce((s, a) => s + a.stats.correct, 0);
    const wrong = here.reduce((s, a) => s + a.stats.wrong, 0);
    const attempts = correct + wrong;
    return { locus, cards: here.length, attempts, accuracy: attempts ? correct / attempts : null, mastered: here.filter(isMastered).length };
  });
}

/** Loci with attempts, weakest first. */
export function weakLoci(loci: Locus[], assignments: Assignment[], limit = 3): LocusStat[] {
  return locusStats(loci, assignments)
    .filter((s) => s.accuracy !== null)
    .sort((a, b) => (a.accuracy! - b.accuracy!) || b.attempts - a.attempts)
    .slice(0, limit);
}

export function activity(logs: ReviewLog[], days = 30, now = new Date()): { day: string; count: number; correct: number }[] {
  const out: { day: string; count: number; correct: number }[] = [];
  const byDay = new Map<string, { count: number; correct: number }>();
  for (const l of logs) {
    const k = dayKey(l.at);
    const v = byDay.get(k) ?? { count: 0, correct: 0 };
    v.count++;
    if (l.grade >= 2) v.correct++;
    byDay.set(k, v);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ day: k, ...(byDay.get(k) ?? { count: 0, correct: 0 }) });
  }
  return out;
}

/** Number of cards coming due on each of the next N days (index 0 = overdue + today). */
export function dueForecast(assignments: Assignment[], days = 7, now = new Date()): number[] {
  const out = new Array(days).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const a of assignments) {
    const diff = Math.floor((new Date(a.srs.due).getTime() - start.getTime()) / 86400000);
    const idx = Math.max(0, diff);
    if (idx < days) out[idx]++;
  }
  return out;
}
