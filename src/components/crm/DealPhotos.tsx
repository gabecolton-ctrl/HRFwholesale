"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDealPhotos, createPhotoUploads, updatePhotoOrder } from "@/app/crm/pipeline/actions";

export function DealPhotos({ dealId, paths, publicBase }: { dealId: string; paths: string[]; publicBase: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    const list = Array.from(files);
    try {
      setBusy(`Preparing ${list.length} photo${list.length > 1 ? "s" : ""}…`);
      const slots = await createPhotoUploads(dealId, list.map((f) => ({ type: f.type, size: f.size })));
      const supabase = createClient();
      const done: string[] = [];
      for (let i = 0; i < list.length; i++) {
        setBusy(`Uploading ${i + 1} of ${list.length}…`);
        const { error } = await supabase.storage.from("deal-photos").uploadToSignedUrl(slots[i].path, slots[i].token, list[i], { contentType: list[i].type });
        if (error) throw new Error(error.message);
        done.push(slots[i].path);
      }
      await addDealPhotos(dealId, done);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section id="photos" className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-ink-soft uppercase">Listing photos ({paths.length})</h2>
        <label className={`btn btn-dark btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ?? "Add photos"}
          <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {err && <p className="mb-3 text-sm font-semibold text-danger">{err}</p>}
      {paths.length === 0 ? (
        <p className="text-sm text-ink-soft">No photos yet. Follow the playbook photo checklist: front, back, every room, kitchen, baths, roof, foundation, HVAC, water heater, and any damage.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {paths.map((p, i) => (
            <li key={p} className="overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${publicBase}/${p}`} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="flex items-center justify-between gap-1 p-1.5 text-xs">
                {i === 0 ? <span className="pill bg-clay text-white">Cover</span> : (
                  <form action={updatePhotoOrder}><input type="hidden" name="deal_id" value={dealId} /><input type="hidden" name="path" value={p} /><input type="hidden" name="action" value="cover" />
                    <button className="underline">Make cover</button></form>
                )}
                <form action={updatePhotoOrder} onSubmit={(e) => { if (!confirm("Remove this photo?")) e.preventDefault(); }}>
                  <input type="hidden" name="deal_id" value={dealId} /><input type="hidden" name="path" value={p} /><input type="hidden" name="action" value="remove" />
                  <button className="text-danger underline">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
