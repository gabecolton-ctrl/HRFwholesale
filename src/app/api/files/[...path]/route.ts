import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { signedLink } from "@/lib/files";

// /api/files/pof/<buyerId>                 → proof of funds
// /api/files/disclosure/<dealId>/<seller|buyer> → signed disclosure
// Access is checked by reading the row AS THE USER (Row Level Security),
// then a 2-minute download link is issued.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const { supabase, profile } = await getSession();
  if (!profile) return new NextResponse("Not allowed", { status: 403 });

  try {
    if (path[0] === "pof" && path[1]) {
      const { data } = await supabase.from("cash_buyers").select("pof_path").eq("id", path[1]).maybeSingle();
      if (!data?.pof_path) return new NextResponse("Not found", { status: 404 });
      return NextResponse.redirect(await signedLink("proof-of-funds", data.pof_path));
    }
    if (path[0] === "disclosure" && path[1] && (path[2] === "seller" || path[2] === "buyer")) {
      const col = `${path[2]}_disclosure_path` as const;
      const { data } = await supabase.from("deals").select(col).eq("id", path[1]).maybeSingle();
      const p = (data as Record<string, string | null> | null)?.[col];
      if (!p) return new NextResponse("Not found", { status: 404 });
      return NextResponse.redirect(await signedLink("disclosures", p));
    }
  } catch (e) {
    console.error("file link failed", e);
    return new NextResponse("Could not open file", { status: 500 });
  }
  return new NextResponse("Not found", { status: 404 });
}
