"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "./Logo";

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sb = getSupabase()!;
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/app` : undefined;

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function google() {
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setError(error.message);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="panel space-y-4">
          <div>
            <h1 className="text-xl font-bold">Sign in to train</h1>
            <p className="text-sm text-slate-400">Your memory paths sync across all your devices.</p>
          </div>
          <button onClick={google} className="btn-ghost w-full">
            <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>
          {sent ? (
            <p className="rounded-xl bg-sea-500/10 p-3 text-sm text-sea-400">Check your inbox — we sent a sign-in link to <b>{email}</b>.</p>
          ) : (
            <form onSubmit={magicLink} className="space-y-3">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending…" : "Email me a magic link"}</button>
            </form>
          )}
          {error && <p className="text-sm text-blood-400">{error}</p>}
        </div>
      </div>
    </main>
  );
}
