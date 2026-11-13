import type { WorkspaceData } from "./types";
import { uid } from "./id";

export const EXPORT_VERSION = 1;

export function exportWorkspace(data: WorkspaceData): string {
  return JSON.stringify({ app: "one-piece-memory-trainer", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";

/** Parses and validates an export file. Throws a readable error on bad input. */
export function parseWorkspaceExport(text: string): WorkspaceData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isObj(json) || json.app !== "one-piece-memory-trainer" || !isObj(json.data)) throw new Error("That file is not a One Piece Memory Trainer export.");
  const d = json.data;
  for (const k of ["paths", "loci", "assignments", "userCards", "logs"]) {
    if (!Array.isArray(d[k])) throw new Error(`Export is missing "${k}".`);
  }
  const data = d as unknown as WorkspaceData;
  const pathIds = new Set(data.paths.map((p) => p.id));
  const lociIds = new Set(data.loci.map((l) => l.id));
  if (!data.paths.every((p) => isStr(p.id) && isStr(p.name))) throw new Error("Export has an invalid path.");
  if (!data.loci.every((l) => isStr(l.id) && isStr(l.name) && pathIds.has(l.pathId))) throw new Error("Export has a locus pointing at a missing path.");
  if (!data.assignments.every((a) => isStr(a.id) && lociIds.has(a.locusId) && pathIds.has(a.pathId) && isObj(a.card) && isObj(a.srs) && isObj(a.stats)))
    throw new Error("Export has a card assignment pointing at a missing locus.");
  return remapIds(data);
}

/**
 * Gives every row a fresh id (keeping references intact) so an export can be
 * imported into any account — e.g. a teammate's — without primary-key clashes.
 */
export function remapIds(data: WorkspaceData, makeId: () => string = uid): WorkspaceData {
  const map = new Map<string, string>();
  const id = (old: string) => {
    if (!map.has(old)) map.set(old, makeId());
    return map.get(old)!;
  };
  const paths = data.paths.map((p) => ({ ...p, id: id(p.id) }));
  const loci = data.loci.map((l) => ({ ...l, id: id(l.id), pathId: id(l.pathId) }));
  const assignments = data.assignments.map((a) => ({ ...a, id: id(a.id), pathId: id(a.pathId), locusId: id(a.locusId) }));
  const userCards = data.userCards.map((c) => ({ ...c, id: id(c.id) }));
  const known = new Set(data.assignments.map((a) => a.id));
  const logs = data.logs
    .filter((l) => known.has(l.assignmentId))
    .map((l) => ({ ...l, id: makeId(), assignmentId: id(l.assignmentId), locusId: id(l.locusId) }));
  return { paths, loci, assignments, userCards, logs };
}
