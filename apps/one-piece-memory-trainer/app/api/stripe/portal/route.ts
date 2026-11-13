import { NextResponse, type NextRequest } from "next/server";
import { getStripe, requireUser, siteUrl } from "@/lib/stripe.server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const { data: profile } = await getSupabaseAdmin().from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
    if (!profile?.stripe_customer_id) return NextResponse.json({ error: "No subscription found." }, { status: 404 });
    const session = await getStripe().billingPortal.sessions.create({ customer: profile.stripe_customer_id, return_url: `${siteUrl(req)}/app/settings` });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] portal", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
