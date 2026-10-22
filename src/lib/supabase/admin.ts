import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Use ONLY on the server for: public form submissions, buyer sign-up,
 * and issuing short-lived file links after an RLS check.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
