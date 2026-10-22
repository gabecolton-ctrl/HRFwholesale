import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppSettings = {
  default_mao_pct: number;
  default_fee: number;
  rehab_turnkey_sqft: number;
  rehab_light_sqft: number;
  rehab_medium_sqft: number;
  rehab_heavy_sqft: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  default_mao_pct: 70,
  default_fee: 10000,
  rehab_turnkey_sqft: 5,
  rehab_light_sqft: 20,
  rehab_medium_sqft: 37.5,
  rehab_heavy_sqft: 55,
};

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, Number(data[k] ?? DEFAULT_SETTINGS[k as keyof AppSettings])])) as AppSettings;
}
