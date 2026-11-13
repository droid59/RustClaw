import type { Grade, SrsState } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export function newSrs(now = new Date()): SrsState {
  return { ease: 2.5, interval: 0, reps: 0, due: now.toISOString(), lastReviewed: null };
}

/**
 * SM-2 variant with a 4-button scale.
 * 0 = forgot (reset), 1 = hard, 2 = good, 3 = easy.
 */
export function schedule(state: SrsState, grade: Grade, now = new Date()): SrsState {
  let { ease, interval, reps } = state;
  if (grade === 0) {
    reps = 0;
    interval = 0; // relearn: due again in 10 minutes
    ease = Math.max(1.3, ease - 0.2);
    return { ease, interval, reps, due: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), lastReviewed: now.toISOString() };
  }
  const q = grade + 2; // map 1..3 -> SM-2 quality 3..5
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  reps += 1;
  if (reps === 1) interval = grade === 3 ? 3 : 1;
  else if (reps === 2) interval = grade === 1 ? 3 : 6;
  else interval = Math.round(interval * ease * (grade === 1 ? 0.6 : grade === 3 ? 1.3 : 1));
  interval = Math.max(1, interval);
  return { ease: Number(ease.toFixed(2)), interval, reps, due: new Date(now.getTime() + interval * DAY).toISOString(), lastReviewed: now.toISOString() };
}

export function isDue(state: SrsState, now = new Date()): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}
