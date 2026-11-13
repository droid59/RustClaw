"use client";

import { useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace";
import { PageTitle } from "@/components/ui";
import { Pricing } from "@/components/Pricing";
import { FREE_LIMITS } from "@/lib/plans";

export default function SettingsPage() {
  const { profile, mode, data, exportJson, importJson, startCheckout, openBillingPortal, signOut, notify } = useWorkspace();
  const isPro = Boolean(profile?.isPro);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function download() {
    if (!isPro) return notify("Export is a Pro feature.", "upgrade");
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memory-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Importing REPLACES all your current paths, cards and history. Continue?")) return;
    setBusy(true);
    await importJson(await file.text());
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" />

      <div className="panel space-y-3">
        <h2 className="font-bold">Plan</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold">{isPro ? <>Pro <span className="pro-badge">Active</span></> : "Free"}</p>
            <p className="text-sm text-slate-400">
              {isPro ? "Unlimited paths and cards, SRS, analytics, export/import." : `${data.paths.length}/${FREE_LIMITS.paths} path · ${data.assignments.length}/${FREE_LIMITS.cards} cards`}
            </p>
          </div>
          {isPro ? (
            mode === "supabase" && <button className="btn-ghost" onClick={() => openBillingPortal()}>Manage billing</button>
          ) : (
            <button className="btn-primary" onClick={() => startCheckout()}>Upgrade to Pro</button>
          )}
        </div>
      </div>

      <div className="panel space-y-3">
        <h2 className="flex items-center gap-2 font-bold">Backup <span className="pro-badge">Pro</span></h2>
        <p className="text-sm text-slate-400">Export every path, locus, card image and review history as JSON — share palaces with teammates or move between accounts.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>⬇ Export JSON</button>
          <button className="btn-ghost" disabled={busy} onClick={() => (isPro ? fileRef.current?.click() : notify("Import is a Pro feature.", "upgrade"))}>⬆ {busy ? "Importing…" : "Import JSON"}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={onImport} />
        </div>
      </div>

      <div className="panel space-y-2">
        <h2 className="font-bold">Account</h2>
        {mode === "local" ? (
          <p className="text-sm text-slate-400">
            Local mode: your data is stored in this browser only. Deploy with Supabase configured to enable accounts, cloud sync and billing.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-400">Signed in as <b className="text-slate-200">{profile?.email}</b></p>
            <button className="btn-ghost btn-sm" onClick={() => signOut()}>Sign out</button>
          </>
        )}
      </div>

      {!isPro && (
        <div>
          <h2 className="mb-3 text-lg font-bold">Compare plans</h2>
          <Pricing cta="/app/settings" />
        </div>
      )}
    </div>
  );
}
