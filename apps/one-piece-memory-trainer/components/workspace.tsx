"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LocalBackend, SupabaseBackend, type Backend } from "@/lib/backend";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { uid } from "@/lib/id";
import { newSrs, schedule } from "@/lib/srs";
import { MASTERY_STREAK } from "@/lib/stats";
import { assertCanAddCard, assertCanAddPath, UpgradeRequiredError } from "@/lib/plans";
import { exportWorkspace, parseWorkspaceExport } from "@/lib/portable";
import type { Assignment, Card, Grade, Locus, MemoryPath, Profile, TrainingMode, WorkspaceData } from "@/lib/types";
import { emptyWorkspace } from "@/lib/types";

export const DEFAULT_LOCI = ["Stove", "Sink", "Table", "Fridge", "Door"];

type Status = "loading" | "signed-out" | "ready" | "error";
interface Toast { id: number; text: string; kind: "info" | "error" | "upgrade" }

interface Ctx {
  status: Status;
  mode: "local" | "supabase";
  profile: Profile | null;
  data: WorkspaceData;
  activePath: MemoryPath | null;
  activeLoci: Locus[];
  activeAssignments: Assignment[];
  setActivePath(id: string): void;
  toasts: Toast[];
  notify(text: string, kind?: Toast["kind"]): void;
  dismiss(id: number): void;
  // paths & loci
  createPath(name: string, loci?: string[]): Promise<MemoryPath | null>;
  renamePath(id: string, name: string): Promise<void>;
  deletePath(id: string): Promise<void>;
  addLocus(pathId: string, name: string): Promise<void>;
  renameLocus(id: string, name: string): Promise<void>;
  moveLocus(id: string, delta: -1 | 1): Promise<void>;
  deleteLocus(id: string): Promise<void>;
  // cards
  assignCard(card: Card, locusId: string, image: string): Promise<boolean>;
  updateAssignment(id: string, patch: Partial<Pick<Assignment, "image" | "locusId">>): Promise<void>;
  removeAssignment(id: string): Promise<void>;
  addUserCard(card: Omit<Card, "id" | "source" | "image">, file: File | null): Promise<Card | null>;
  deleteUserCard(id: string): Promise<void>;
  // training
  grade(assignmentId: string, grade: Grade, mode: TrainingMode): Promise<void>;
  // pro
  exportJson(): string;
  importJson(text: string): Promise<void>;
  startCheckout(): Promise<void>;
  openBillingPortal(): Promise<void>;
  signOut(): Promise<void>;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

const ACTIVE_KEY = "opmt:active-path";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace());
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const dataRef = useRef<WorkspaceData>(data);
  const backendRef = useRef<Backend | null>(null);
  const toastId = useRef(0);
  const bootedFor = useRef<string | null>(null);

  const notify = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "info" ? 3000 : 6000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /** Optimistically apply `next`, persist via `op`, roll back on failure. */
  const commit = useCallback(
    async (next: WorkspaceData, op: (b: Backend) => Promise<void>): Promise<boolean> => {
      const prev = dataRef.current;
      dataRef.current = next;
      setData(next);
      try {
        await op(backendRef.current!);
        return true;
      } catch (e) {
        dataRef.current = prev;
        setData(prev);
        notify((e as Error).message, /Upgrade|Free plan/.test((e as Error).message) ? "upgrade" : "error");
        return false;
      }
    },
    [notify],
  );

  // ---------- boot ----------
  const boot = useCallback(
    async (backend: Backend) => {
      backendRef.current = backend;
      try {
        const [p, d] = await Promise.all([backend.profile(), backend.load()]);
        setProfile(p);
        dataRef.current = d;
        setData(d);
        let stored: string | null = null;
        try { stored = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
        setActivePathId(d.paths.find((x) => x.id === stored)?.id ?? d.paths[0]?.id ?? null);
        setStatus("ready");
        if (!d.paths.length) {
          // First run: create the kitchen example path.
          const path: MemoryPath = { id: uid(), name: "Kitchen", createdAt: new Date().toISOString() };
          const loci = DEFAULT_LOCI.map((name, position) => ({ id: uid(), pathId: path.id, name, position }));
          const next = { ...d, paths: [path], loci };
          const ok = await commit(next, async (b) => { await b.addPath(path); await b.saveLoci(loci); });
          if (ok) setActivePathId(path.id);
        }
      } catch (e) {
        notify((e as Error).message, "error");
        setStatus("error");
      }
    },
    [commit, notify],
  );

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      if (bootedFor.current === "local") return;
      bootedFor.current = "local";
      void boot(new LocalBackend(() => dataRef.current));
      return;
    }
    const handle = (s: Session | null) => {
      setSession(s);
      if (!s) {
        bootedFor.current = null;
        backendRef.current = null;
        setStatus("signed-out");
        return;
      }
      if (bootedFor.current === s.user.id) return;
      bootedFor.current = s.user.id;
      setStatus("loading");
      void boot(new SupabaseBackend(sb, s.user.id));
    };
    sb.auth.getSession().then(({ data: { session: s } }) => handle(s));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => handle(s));
    return () => sub.subscription.unsubscribe();
  }, [boot]);

  // Refresh Pro status after returning from Stripe checkout.
  useEffect(() => {
    if (status !== "ready" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") !== "1") return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const p = await backendRef.current?.profile().catch(() => null);
      if (p?.isPro) {
        setProfile(p);
        notify("Welcome to Pro! Everything is unlocked.");
        clearInterval(timer);
      } else if (tries > 10) clearInterval(timer);
    }, 1500);
    return () => clearInterval(timer);
  }, [status, notify]);

  const setActivePath = useCallback((id: string) => {
    setActivePathId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
  }, []);

  const isPro = Boolean(profile?.isPro);
  const guard = useCallback(
    (fn: () => void): boolean => {
      try {
        fn();
        return true;
      } catch (e) {
        if (e instanceof UpgradeRequiredError) notify(e.message, "upgrade");
        else throw e;
        return false;
      }
    },
    [notify],
  );

  // ---------- paths & loci ----------
  const createPath = useCallback<Ctx["createPath"]>(
    async (name, lociNames = DEFAULT_LOCI) => {
      const d = dataRef.current;
      if (!guard(() => assertCanAddPath(isPro, d.paths.length))) return null;
      const path: MemoryPath = { id: uid(), name: name.trim() || "New path", createdAt: new Date().toISOString() };
      const loci = lociNames.map((n, position) => ({ id: uid(), pathId: path.id, name: n, position }));
      const ok = await commit({ ...d, paths: [...d.paths, path], loci: [...d.loci, ...loci] }, async (b) => {
        await b.addPath(path);
        await b.saveLoci(loci);
      });
      if (ok) setActivePath(path.id);
      return ok ? path : null;
    },
    [commit, guard, isPro, setActivePath],
  );

  const renamePath = useCallback<Ctx["renamePath"]>(async (id, name) => {
    const d = dataRef.current;
    const p = d.paths.find((x) => x.id === id);
    if (!p || !name.trim()) return;
    const np = { ...p, name: name.trim() };
    await commit({ ...d, paths: d.paths.map((x) => (x.id === id ? np : x)) }, (b) => b.updatePath(np));
  }, [commit]);

  const deletePath = useCallback<Ctx["deletePath"]>(async (id) => {
    const d = dataRef.current;
    const lociIds = new Set(d.loci.filter((l) => l.pathId === id).map((l) => l.id));
    const ok = await commit(
      { ...d, paths: d.paths.filter((p) => p.id !== id), loci: d.loci.filter((l) => l.pathId !== id), assignments: d.assignments.filter((a) => !lociIds.has(a.locusId)) },
      (b) => b.deletePath(id),
    );
    if (ok) {
      const remaining = dataRef.current.paths[0];
      if (remaining) setActivePath(remaining.id);
      else setActivePathId(null);
    }
  }, [commit, setActivePath]);

  const addLocus = useCallback<Ctx["addLocus"]>(async (pathId, name) => {
    const d = dataRef.current;
    const siblings = d.loci.filter((l) => l.pathId === pathId);
    const l: Locus = { id: uid(), pathId, name: name.trim() || `Spot ${siblings.length + 1}`, position: siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0 };
    await commit({ ...d, loci: [...d.loci, l] }, (b) => b.saveLoci([l]));
  }, [commit]);

  const renameLocus = useCallback<Ctx["renameLocus"]>(async (id, name) => {
    const d = dataRef.current;
    const l = d.loci.find((x) => x.id === id);
    if (!l || !name.trim()) return;
    const nl = { ...l, name: name.trim() };
    await commit({ ...d, loci: d.loci.map((x) => (x.id === id ? nl : x)) }, (b) => b.saveLoci([nl]));
  }, [commit]);

  const moveLocus = useCallback<Ctx["moveLocus"]>(async (id, delta) => {
    const d = dataRef.current;
    const l = d.loci.find((x) => x.id === id);
    if (!l) return;
    const ordered = d.loci.filter((x) => x.pathId === l.pathId).sort((a, b) => a.position - b.position);
    const i = ordered.findIndex((x) => x.id === id);
    const j = i + delta;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const renumbered = ordered.map((x, position) => ({ ...x, position }));
    const byId = new Map(renumbered.map((x) => [x.id, x]));
    await commit({ ...d, loci: d.loci.map((x) => byId.get(x.id) ?? x) }, (b) => b.saveLoci(renumbered));
  }, [commit]);

  const deleteLocus = useCallback<Ctx["deleteLocus"]>(async (id) => {
    const d = dataRef.current;
    await commit({ ...d, loci: d.loci.filter((l) => l.id !== id), assignments: d.assignments.filter((a) => a.locusId !== id) }, (b) => b.deleteLocus(id));
  }, [commit]);

  // ---------- cards ----------
  const assignCard = useCallback<Ctx["assignCard"]>(async (card, locusId, image) => {
    const d = dataRef.current;
    if (!guard(() => assertCanAddCard(isPro, d.assignments.length))) return false;
    const locus = d.loci.find((l) => l.id === locusId);
    if (!locus) return false;
    const a: Assignment = {
      id: uid(), pathId: locus.pathId, locusId, card, image: image.trim(), createdAt: new Date().toISOString(),
      srs: newSrs(), stats: { correct: 0, wrong: 0, streak: 0 },
    };
    const ok = await commit({ ...d, assignments: [...d.assignments, a] }, (b) => b.addAssignment(a));
    if (ok) notify(`${card.name} placed at the ${locus.name}.`);
    return ok;
  }, [commit, guard, isPro, notify]);

  const updateAssignment = useCallback<Ctx["updateAssignment"]>(async (id, patch) => {
    const d = dataRef.current;
    const a = d.assignments.find((x) => x.id === id);
    if (!a) return;
    const locus = patch.locusId ? d.loci.find((l) => l.id === patch.locusId) : null;
    const na = { ...a, ...patch, ...(locus ? { pathId: locus.pathId } : {}) };
    await commit({ ...d, assignments: d.assignments.map((x) => (x.id === id ? na : x)) }, (b) => b.updateAssignment(na));
  }, [commit]);

  const removeAssignment = useCallback<Ctx["removeAssignment"]>(async (id) => {
    const d = dataRef.current;
    await commit({ ...d, assignments: d.assignments.filter((a) => a.id !== id) }, (b) => b.deleteAssignment(id));
  }, [commit]);

  const addUserCard = useCallback<Ctx["addUserCard"]>(async (fields, file) => {
    let image: string | null = null;
    if (file) {
      try {
        image = await backendRef.current!.uploadImage(file);
      } catch (e) {
        notify(`Upload failed: ${(e as Error).message}`, "error");
        return null;
      }
    }
    const card: Card = { ...fields, id: uid(), image, source: "upload" };
    const d = dataRef.current;
    const ok = await commit({ ...d, userCards: [...d.userCards, card] }, (b) => b.addUserCard(card));
    return ok ? card : null;
  }, [commit, notify]);

  const deleteUserCard = useCallback<Ctx["deleteUserCard"]>(async (id) => {
    const d = dataRef.current;
    await commit({ ...d, userCards: d.userCards.filter((c) => c.id !== id) }, (b) => b.deleteUserCard(id));
  }, [commit]);

  // ---------- training ----------
  const grade = useCallback<Ctx["grade"]>(async (assignmentId, g, mode) => {
    const d = dataRef.current;
    const a = d.assignments.find((x) => x.id === assignmentId);
    if (!a) return;
    const correct = g >= 2;
    const na: Assignment = {
      ...a,
      srs: schedule(a.srs, g),
      stats: { correct: a.stats.correct + (correct ? 1 : 0), wrong: a.stats.wrong + (correct ? 0 : 1), streak: correct ? a.stats.streak + 1 : 0 },
    };
    const log = { id: uid(), assignmentId, locusId: a.locusId, grade: g, mode, at: new Date().toISOString() };
    const ok = await commit({ ...d, assignments: d.assignments.map((x) => (x.id === a.id ? na : x)), logs: [...d.logs, log] }, async (b) => {
      await b.updateAssignment(na);
      await b.addLog(log);
    });
    if (ok && na.stats.streak === MASTERY_STREAK) notify(`Mastered: ${a.card.name}!`);
  }, [commit, notify]);

  // ---------- pro ----------
  const exportJson = useCallback(() => exportWorkspace(dataRef.current), []);

  const importJson = useCallback<Ctx["importJson"]>(async (text) => {
    if (!isPro) {
      notify("Import is a Pro feature.", "upgrade");
      return;
    }
    let parsed: WorkspaceData;
    try {
      parsed = parseWorkspaceExport(text);
    } catch (e) {
      notify((e as Error).message, "error");
      return;
    }
    const ok = await commit(parsed, (b) => b.replaceAll(parsed));
    if (ok) {
      setActivePathId(parsed.paths[0]?.id ?? null);
      notify(`Imported ${parsed.paths.length} paths and ${parsed.assignments.length} cards.`);
    }
  }, [commit, isPro, notify]);

  const authedPost = useCallback(async (url: string) => {
    if (!supabaseConfigured || !session) {
      notify("Create a free account to upgrade — local mode has no billing.", "upgrade");
      return;
    }
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      notify(body.error ?? "Billing is unavailable right now.", "error");
      return;
    }
    window.location.href = body.url;
  }, [notify, session]);

  const startCheckout = useCallback(() => authedPost("/api/stripe/checkout"), [authedPost]);
  const openBillingPortal = useCallback(() => authedPost("/api/stripe/portal"), [authedPost]);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    dataRef.current = emptyWorkspace();
    setData(dataRef.current);
    setProfile(null);
  }, []);

  const activePath = data.paths.find((p) => p.id === activePathId) ?? data.paths[0] ?? null;
  const activeLoci = useMemo(
    () => (activePath ? data.loci.filter((l) => l.pathId === activePath.id).sort((a, b) => a.position - b.position) : []),
    [activePath, data.loci],
  );
  const activeAssignments = useMemo(() => (activePath ? data.assignments.filter((a) => a.pathId === activePath.id) : []), [activePath, data.assignments]);

  const value: Ctx = {
    status, mode: supabaseConfigured ? "supabase" : "local", profile, data, activePath, activeLoci, activeAssignments, setActivePath,
    toasts, notify, dismiss, createPath, renamePath, deletePath, addLocus, renameLocus, moveLocus, deleteLocus,
    assignCard, updateAssignment, removeAssignment, addUserCard, deleteUserCard, grade, exportJson, importJson,
    startCheckout, openBillingPortal, signOut,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
