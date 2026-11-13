import "server-only";
import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase";

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY).");
  stripe ??= new Stripe(key);
  return stripe;
}

export function siteUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

/** Resolves the Supabase user from the request's Bearer token. */
export async function requireUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);
export const isActiveStatus = (status: string) => ACTIVE.has(status);
