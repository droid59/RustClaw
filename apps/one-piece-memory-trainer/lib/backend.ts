import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, Card, Locus, MemoryPath, Profile, ReviewLog, WorkspaceData } from "./types";
import { emptyWorkspace } from "./types";
import { blobToDataUrl, resizeImage } from "./image";
import { uid } from "./id";

/**
 * Persistence for a user's workspace. The provider keeps everything in memory and
 * calls these after each optimistic update.
 */
export interface Backend {
  kind: "local" | "supabase";
  profile(): Promise<Profile>;
  load(): Promise<WorkspaceData>;
  addPath(p: MemoryPath): Promise<void>;
  updatePath(p: MemoryPath): Promise<void>;
  deletePath(id: string): Promise<void>;
  saveLoci(loci: Locus[]): Promise<void>;
  deleteLocus(id: string): Promise<void>;
  addAssignment(a: Assignment): Promise<void>;
  updateAssignment(a: Assignment): Promise<void>;
  deleteAssignment(id: string): Promise<void>;
  addUserCard(c: Card): Promise<void>;
  deleteUserCard(id: string): Promise<void>;
  addLog(l: ReviewLog): Promise<void>;
  uploadImage(file: Blob): Promise<string>;
  replaceAll(data: WorkspaceData): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local mode: everything lives in localStorage. No account needed.
// ---------------------------------------------------------------------------
const LOCAL_KEY = "opmt:workspace:v1";

export class LocalBackend implements Backend {
  kind = "local" as const;
  constructor(private getState: () => WorkspaceData) {}

  private persist = async () => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(this.getState()));
    } catch (e) {
      throw new Error("Browser storage is full. Remove some uploaded images or sign up to store data in the cloud.");
    }
  };

  async profile(): Promise<Profile> {
    return { id: "local", email: null, isPro: process.env.NEXT_PUBLIC_LOCAL_PRO === "true" };
  }
  async load(): Promise<WorkspaceData> {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return { ...emptyWorkspace(), ...JSON.parse(raw) };
    } catch {
      /* corrupted or unavailable storage: start fresh */
    }
    return emptyWorkspace();
  }
  addPath = this.persist;
  updatePath = this.persist;
  deletePath = this.persist;
  saveLoci = this.persist;
  deleteLocus = this.persist;
  addAssignment = this.persist;
  updateAssignment = this.persist;
  deleteAssignment = this.persist;
  addUserCard = this.persist;
  deleteUserCard = this.persist;
  addLog = this.persist;
  replaceAll = this.persist;
  async uploadImage(file: Blob): Promise<string> {
    return blobToDataUrl(await resizeImage(file, 480, 0.8));
  }
}

// ---------------------------------------------------------------------------
// Supabase mode
// ---------------------------------------------------------------------------
type Row = Record<string, any>;

function friendly(error: { message: string } | null) {
  if (!error) return;
  const m = error.message;
  if (m.includes("FREE_LIMIT_PATHS")) throw new Error("Free plan includes 1 memory path. Upgrade to Pro for unlimited paths.");
  if (m.includes("FREE_LIMIT_CARDS")) throw new Error("Free plan includes 20 cards. Upgrade to Pro for unlimited cards.");
  throw new Error(m);
}

const toPath = (r: Row): MemoryPath => ({ id: r.id, name: r.name, createdAt: r.created_at });
const toLocus = (r: Row): Locus => ({ id: r.id, pathId: r.path_id, name: r.name, position: r.position });
const toAssignment = (r: Row): Assignment => ({ id: r.id, pathId: r.path_id, locusId: r.locus_id, card: r.card, image: r.image, createdAt: r.created_at, srs: r.srs, stats: r.stats });
const toLog = (r: Row): ReviewLog => ({ id: r.id, assignmentId: r.assignment_id, locusId: r.locus_id, grade: r.grade, mode: r.mode, at: r.at });
const assignmentRow = (a: Assignment) => ({ id: a.id, path_id: a.pathId, locus_id: a.locusId, card: a.card, image: a.image, srs: a.srs, stats: a.stats, created_at: a.createdAt });

export class SupabaseBackend implements Backend {
  kind = "supabase" as const;
  constructor(private sb: SupabaseClient, private userId: string) {}

  async profile(): Promise<Profile> {
    const { data, error } = await this.sb.from("profiles").select("id,email,is_pro").eq("id", this.userId).maybeSingle();
    friendly(error);
    return { id: this.userId, email: data?.email ?? null, isPro: Boolean(data?.is_pro) };
  }

  async load(): Promise<WorkspaceData> {
    const [paths, loci, assignments, userCards, logs] = await Promise.all([
      this.sb.from("paths").select("*").order("created_at"),
      this.sb.from("loci").select("*").order("position"),
      this.sb.from("assignments").select("*").order("created_at"),
      this.sb.from("user_cards").select("*").order("created_at"),
      this.sb.from("review_logs").select("*").order("at", { ascending: false }).limit(5000),
    ]);
    for (const r of [paths, loci, assignments, userCards, logs]) friendly(r.error);
    return {
      paths: (paths.data ?? []).map(toPath),
      loci: (loci.data ?? []).map(toLocus),
      assignments: (assignments.data ?? []).map(toAssignment),
      userCards: (userCards.data ?? []).map((r: Row) => ({ ...r.card, id: r.id })),
      logs: (logs.data ?? []).map(toLog).reverse(),
    };
  }

  async addPath(p: MemoryPath) {
    friendly((await this.sb.from("paths").insert({ id: p.id, name: p.name, created_at: p.createdAt })).error);
  }
  async updatePath(p: MemoryPath) {
    friendly((await this.sb.from("paths").update({ name: p.name }).eq("id", p.id)).error);
  }
  async deletePath(id: string) {
    friendly((await this.sb.from("paths").delete().eq("id", id)).error);
  }
  async saveLoci(loci: Locus[]) {
    if (!loci.length) return;
    friendly((await this.sb.from("loci").upsert(loci.map((l) => ({ id: l.id, path_id: l.pathId, name: l.name, position: l.position })))).error);
  }
  async deleteLocus(id: string) {
    friendly((await this.sb.from("loci").delete().eq("id", id)).error);
  }
  async addAssignment(a: Assignment) {
    friendly((await this.sb.from("assignments").insert(assignmentRow(a))).error);
  }
  async updateAssignment(a: Assignment) {
    const { id, ...rest } = assignmentRow(a);
    friendly((await this.sb.from("assignments").update(rest).eq("id", id)).error);
  }
  async deleteAssignment(id: string) {
    friendly((await this.sb.from("assignments").delete().eq("id", id)).error);
  }
  async addUserCard(c: Card) {
    friendly((await this.sb.from("user_cards").insert({ id: c.id, card: c })).error);
  }
  async deleteUserCard(id: string) {
    friendly((await this.sb.from("user_cards").delete().eq("id", id)).error);
  }
  async addLog(l: ReviewLog) {
    friendly((await this.sb.from("review_logs").insert({ id: l.id, assignment_id: l.assignmentId, locus_id: l.locusId, grade: l.grade, mode: l.mode, at: l.at })).error);
  }
  async uploadImage(file: Blob): Promise<string> {
    const blob = await resizeImage(file, 720, 0.85);
    const path = `${this.userId}/${uid()}.jpg`;
    const { error } = await this.sb.storage.from("card-uploads").upload(path, blob, { contentType: "image/jpeg" });
    friendly(error);
    return this.sb.storage.from("card-uploads").getPublicUrl(path).data.publicUrl;
  }
  /** Import (Pro): wipe and re-insert. Cascades remove loci/assignments. */
  async replaceAll(data: WorkspaceData) {
    friendly((await this.sb.from("review_logs").delete().eq("user_id", this.userId)).error);
    friendly((await this.sb.from("user_cards").delete().eq("user_id", this.userId)).error);
    friendly((await this.sb.from("paths").delete().eq("user_id", this.userId)).error);
    if (data.paths.length) friendly((await this.sb.from("paths").insert(data.paths.map((p) => ({ id: p.id, name: p.name, created_at: p.createdAt })))).error);
    await this.saveLoci(data.loci);
    if (data.assignments.length) friendly((await this.sb.from("assignments").insert(data.assignments.map(assignmentRow))).error);
    if (data.userCards.length) friendly((await this.sb.from("user_cards").insert(data.userCards.map((c) => ({ id: c.id, card: c })))).error);
    for (let i = 0; i < data.logs.length; i += 500) {
      const chunk = data.logs.slice(i, i + 500).map((l) => ({ id: l.id, assignment_id: l.assignmentId, locus_id: l.locusId, grade: l.grade, mode: l.mode, at: l.at }));
      friendly((await this.sb.from("review_logs").insert(chunk)).error);
    }
  }
}
