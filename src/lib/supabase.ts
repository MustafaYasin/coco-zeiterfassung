import { Preferences } from "@capacitor/preferences";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { isNative } from "@/lib/native";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_ANON_KEY as string;

/** In the app the login lives in native storage, so iOS never evicts it. */
const nativeStorage: SupportedStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: (key, value) => Preferences.set({ key, value }),
  removeItem: (key) => Preferences.remove({ key }),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: isNative ? { storage: nativeStorage } : undefined,
});

/** Domain used to synthesize login emails for username-based accounts. */
export const CREW_DOMAIN = "crew.coco-munich.de";

export function loginEmail(usernameOrEmail: string): string {
  const value = usernameOrEmail.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${CREW_DOMAIN}`;
}
