import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isActiveStatus } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Stripe → Supabase sync. Configure in Stripe with events:
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id ?? s.metadata?.user_id;
        if (!userId || s.mode !== "subscription") break;
        const { error } = await admin
          .from("profiles")
          .update({ is_pro: true, stripe_customer_id: String(s.customer), stripe_subscription_id: String(s.subscription), subscription_status: "active" })
          .eq("id", userId);
        if (error) throw error;
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const active = event.type !== "customer.subscription.deleted" && isActiveStatus(sub.status);
        const patch = { is_pro: active, stripe_subscription_id: sub.id, subscription_status: sub.status, stripe_customer_id: String(sub.customer) };
        const userId = sub.metadata?.user_id;
        const q = admin.from("profiles").update(patch);
        const { error } = userId ? await q.eq("id", userId) : await q.eq("stripe_customer_id", String(sub.customer));
        if (error) throw error;
        break;
      }
    }
  } catch (e) {
    console.error("[stripe] webhook", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
