export const FREE_LIMITS = { paths: 1, cards: 20 } as const;

export const PLAN_FEATURES = {
  free: [
    "1 memory path",
    "Up to 20 cards",
    "Review, Drill & Speed modes",
    "One-click vivid image suggestions",
    "Card uploads + live card database",
    "Streak & mastery dashboard",
  ],
  pro: [
    "Unlimited memory paths",
    "Unlimited cards",
    "Spaced-repetition scheduling (Due queue)",
    "Export / import your palaces (JSON)",
    "Full progress analytics: per-locus accuracy, 30-day activity, due forecast",
    "Priority support",
  ],
} as const;

export class UpgradeRequiredError extends Error {
  constructor(public readonly reason: "paths" | "cards" | "feature", message: string) {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}

export function assertCanAddPath(isPro: boolean, currentPaths: number) {
  if (!isPro && currentPaths >= FREE_LIMITS.paths) {
    throw new UpgradeRequiredError("paths", `Free plan includes ${FREE_LIMITS.paths} memory path. Upgrade to Pro for unlimited paths.`);
  }
}

export function assertCanAddCard(isPro: boolean, currentCards: number) {
  if (!isPro && currentCards >= FREE_LIMITS.cards) {
    throw new UpgradeRequiredError("cards", `Free plan includes ${FREE_LIMITS.cards} cards. Upgrade to Pro for unlimited cards.`);
  }
}
