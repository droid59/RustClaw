const STOP = new Set(
  "a an the of to and or your you this that up 1 card cards during turn in on with for from it its is are be may can by as at any".split(" "),
);

export function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[\[\]().,:;!?"']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Scores how well a typed recall covers the real effect: the fraction of the
 * effect's key terms (keywords + numbers) that appear in the answer.
 */
export function recallScore(answer: string, effect: string): number {
  const target = [...new Set(keywords(effect))];
  if (!target.length) return answer.trim() ? 1 : 0;
  const given = new Set(keywords(answer).map(stem));
  const hits = target.filter((w) => given.has(stem(w))).length;
  return hits / target.length;
}

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "");
}

export function isRecallCorrect(answer: string, effect: string, threshold = 0.5): boolean {
  return recallScore(answer, effect) >= threshold;
}
