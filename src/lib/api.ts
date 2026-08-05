import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";

type AdminAction =
  | {
      action: "create_user";
      username: string;
      display_name: string;
      password: string;
      email?: string;
      is_admin?: boolean;
    }
  | { action: "set_password"; member_id: string; password: string }
  | { action: "deactivate"; member_id: string }
  | {
      action: "reactivate";
      member_id: string;
      password: string;
      email?: string;
    }
  | { action: "delete_user"; member_id: string };

/** Calls the admin edge function; throws with a readable message on failure. */
export async function adminAction(body: AdminAction): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Nicht angemeldet");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Fehler (${response.status})`);
  }
}
