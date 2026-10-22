"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { requestMeta } from "@/lib/request-meta";
import { ASSIGNMENT_DISCLOSURE, site } from "@/lib/site";
import { notifyTeam } from "@/lib/email";
import { money, toNumber, toText } from "@/lib/format";

export async function acknowledgeDeal(fd: FormData) {
  const { supabase } = await requireRole("buyer");
  const id = String(fd.get("deal_id"));
  if (fd.get("agree") !== "on") redirect(`/portal/deals/${id}?error=${encodeURIComponent("Tick the box to acknowledge the disclosure.")}`);
  const meta = await requestMeta();
  const { error } = await supabase.rpc("acknowledge_deal", {
    p_deal_id: id,
    p_disclosure: ASSIGNMENT_DISCLOSURE,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  if (error) redirect(`/portal/deals/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/portal/deals/${id}`);
  redirect(`/portal/deals/${id}#details`);
}

export async function submitInterest(fd: FormData) {
  const { supabase, profile } = await requireRole("buyer");
  const id = String(fd.get("deal_id"));
  const kind = fd.get("kind") === "offer" ? "offer" : "interest";
  const amount = toNumber(fd.get("amount"));
  if (kind === "offer" && (!amount || amount <= 0)) redirect(`/portal/deals/${id}?error=${encodeURIComponent("Enter your offer amount.")}#offer`);
  const { error } = await supabase.rpc("submit_deal_interest", {
    p_deal_id: id,
    p_kind: kind,
    p_amount: kind === "offer" ? amount : null,
    p_close_by: toText(fd.get("close_by")),
    p_message: toText(fd.get("message"))?.slice(0, 2000) ?? null,
  });
  if (error) redirect(`/portal/deals/${id}?error=${encodeURIComponent(error.message)}#offer`);

  const { data: me } = await supabase.from("cash_buyers").select("name,company,phone,pof_verified").maybeSingle();
  const { data: list } = await supabase.rpc("portal_deals");
  const deal = (list ?? []).find((d: { id: string }) => d.id === id) as { address?: string; area?: string } | undefined;
  await notifyTeam(
    `${kind === "offer" ? `Offer ${money(amount)}` : "Buyer interest"}: ${deal?.address ?? deal?.area ?? "deal"}`,
    [
      `${me?.name ?? profile.full_name ?? "A buyer"}${me?.company ? ` (${me.company})` : ""} · ${me?.phone ?? ""}`,
      kind === "offer" ? `Offer: ${money(amount)}${toText(fd.get("close_by")) ? `, close by ${toText(fd.get("close_by"))}` : ""}` : "Wants more info",
      toText(fd.get("message")) ?? "",
      me?.pof_verified ? "Proof of funds: verified" : "Proof of funds: NOT verified yet",
    ].filter(Boolean),
    `${site.url}/crm/pipeline/${id}#offers`,
  );
  revalidatePath(`/portal/deals/${id}`);
  redirect(`/portal/deals/${id}?sent=${kind}#offer`);
}
