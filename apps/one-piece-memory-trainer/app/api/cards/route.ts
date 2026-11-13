import { NextResponse, type NextRequest } from "next/server";
import { getCatalog } from "@/lib/cardSource.server";
import { searchCards } from "@/lib/cards";

export const dynamic = "force-dynamic";

/** GET /api/cards?q=luffy&color=red&set=OP01&type=character&limit=48&offset=0 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const catalog = await getCatalog();
  const { total, results } = searchCards(catalog.cards, {
    q: sp.get("q") ?? undefined,
    color: sp.get("color") ?? undefined,
    set: sp.get("set") ?? undefined,
    type: sp.get("type") ?? undefined,
    limit: Number(sp.get("limit") ?? 48),
    offset: Number(sp.get("offset") ?? 0),
  });
  const sets = [...new Set(catalog.cards.map((c) => c.code.split("-")[0]))].sort();
  return NextResponse.json(
    { total, results, sets, source: catalog.source, fetchedAt: catalog.fetchedAt },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
