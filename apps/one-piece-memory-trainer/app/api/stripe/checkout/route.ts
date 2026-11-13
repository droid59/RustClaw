import { NextResponse, type NextRequest } from "next/server";
import { getStripe, requireUser, siteUrl } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const price = process.env.STRIPE_PRO_PRICE_ID;
    if (!price) return NextResponse.json({ error: "Pro plan is not configured (STRIPE_PRO_PRICE_ID)." }, { status: 500 });

    const { data: profile } = await getSupabaseAdmin().from("profiles").select("stripe_customer_id,is_pro").eq("id", user.id).maybeSingle();
    if (profile?.is_pro) return NextResponse.json({ error: "You're already Pro." }, { status: 400 });

    const base = siteUrl(req);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email ?? undefined }),
      allow_promotion_codes: true,
      success_url: `${base}/app?upgraded=1`,
      cancel_url: `${base}/app/settings?canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] checkout", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
