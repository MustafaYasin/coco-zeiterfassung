import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Domain used to synthesize login emails for username-based accounts. */
export const CREW_DOMAIN = "crew.coco-munich.de";

export function loginEmail(usernameOrEmail: string): string {
  const value = usernameOrEmail.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${CREW_DOMAIN}`;
}
