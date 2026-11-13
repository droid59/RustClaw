export type CardSource = "online" | "upload" | "demo";

export interface Card {
  /** Stable id: the card code for online cards (e.g. "OP01-001"), a uuid for uploads. */
  id: string;
  code: string;
  name: string;
  effect: string;
  cost: number | null;
  power: number | null;
  counter: number | null;
  color: string;
  type: string;
  set: string;
  rarity: string;
  image: string | null;
  source: CardSource;
}

export interface MemoryPath {
  id: string;
  name: string;
  createdAt: string;
}

export interface Locus {
  id: string;
  pathId: string;
  name: string;
  position: number;
}

export interface SrsState {
  ease: number;
  /** Interval in days. */
  interval: number;
  reps: number;
  /** ISO timestamp of next due review. */
  due: string;
  lastReviewed: string | null;
}

export interface AssignmentStats {
  correct: number;
  wrong: number;
  /** Consecutive correct recalls. 3+ counts as mastered. */
  streak: number;
}

export interface Assignment {
  id: string;
  pathId: string;
  locusId: string;
  /** Snapshot of the card so assignments survive upstream data changes. */
  card: Card;
  /** The vivid Bruno-style image the user will recall. */
  image: string;
  createdAt: string;
  srs: SrsState;
  stats: AssignmentStats;
}

/** 0 = forgot, 1 = hard, 2 = good, 3 = easy */
export type Grade = 0 | 1 | 2 | 3;
export type TrainingMode = "review" | "drill" | "speed";

export interface ReviewLog {
  id: string;
  assignmentId: string;
  locusId: string;
  grade: Grade;
  mode: TrainingMode;
  at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  isPro: boolean;
}

export interface WorkspaceData {
  paths: MemoryPath[];
  loci: Locus[];
  assignments: Assignment[];
  userCards: Card[];
  logs: ReviewLog[];
}

export const emptyWorkspace = (): WorkspaceData => ({
  paths: [],
  loci: [],
  assignments: [],
  userCards: [],
  logs: [],
});
