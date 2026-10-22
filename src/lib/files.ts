import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["image/webp", "webp"],
]);

export function checkUpload(file: File | null): string | null {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 4 MB. Try a PDF or a smaller photo.";
  if (!ALLOWED.has(file.type)) return "Upload a PDF or a photo (JPG, PNG, HEIC).";
  return null;
}

/** Uploads to a PRIVATE bucket and returns the stored path. */
export async function uploadPrivate(bucket: "proof-of-funds" | "disclosures", folder: string, file: File) {
  const ext = ALLOWED.get(file.type) ?? "bin";
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40) || "file";
  const path = `${folder}/${Date.now()}-${safe}.${ext}`;
  const db = createAdminClient();
  const { error } = await db.storage.from(bucket).upload(path, await file.arrayBuffer(), {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Short-lived download link. Call ONLY after confirming access through an RLS query. */
export async function signedLink(bucket: "proof-of-funds" | "disclosures", path: string, seconds = 120) {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
