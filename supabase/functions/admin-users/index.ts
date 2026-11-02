import { createClient } from "jsr:@supabase/supabase-js@2";

// Copy of the deployed function (version 1, 2026-08-05) for local testing.
// Only change: the one-time bootstrap secret comes from the environment
// instead of being hard-coded. It is only usable while members is empty.
const SETUP_SECRET = Deno.env.get("SETUP_SECRET") ?? "";
const CREW_DOMAIN = "crew.coco-munich.de";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-setup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function crewEmail(username: string, email?: string): string {
  return email && email.includes("@") ? email : `${username}@${CREW_DOMAIN}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const body = await req.json().catch(() => null);
  if (!body?.action) return json(400, { error: "missing action" });

  // Authorization: either one-time bootstrap (empty members table + secret)
  // or a logged-in active admin.
  const { count } = await admin
    .from("members")
    .select("*", { count: "exact", head: true });
  const bootstrap =
    SETUP_SECRET !== "" &&
    (count ?? 0) === 0 &&
    req.headers.get("x-setup-token") === SETUP_SECRET;

  if (!bootstrap) {
    const token = (req.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json(401, { error: "not authenticated" });
    const { data: me } = await admin
      .from("members")
      .select("is_admin, active")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!me?.is_admin || !me.active) return json(403, { error: "admin only" });
  }

  try {
    switch (body.action) {
      case "create_user": {
        const { username, display_name, password, email, is_admin } = body;
        if (!/^[a-z0-9_-]{2,32}$/.test(username ?? ""))
          return json(400, { error: "invalid username" });
        if (!display_name || !password || password.length < 6)
          return json(400, { error: "display_name and password (min 6) required" });

        const { data: created, error: authErr } =
          await admin.auth.admin.createUser({
            email: crewEmail(username, email),
            password,
            email_confirm: true,
          });
        if (authErr) return json(400, { error: authErr.message });

        // Link an existing (imported) member row if present, else insert.
        const { data: existing } = await admin
          .from("members")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        const dbOp = existing
          ? admin
              .from("members")
              .update({
                user_id: created.user.id,
                display_name,
                is_admin: !!is_admin,
                active: true,
              })
              .eq("id", existing.id)
          : admin.from("members").insert({
              user_id: created.user.id,
              username,
              display_name,
              is_admin: !!is_admin,
              active: true,
            });
        const { error: dbErr } = await dbOp;
        if (dbErr) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json(400, { error: dbErr.message });
        }
        return json(200, { ok: true });
      }

      case "set_password": {
        const { member_id, password } = body;
        if (!password || password.length < 6)
          return json(400, { error: "password min 6 chars" });
        const { data: m } = await admin
          .from("members")
          .select("user_id")
          .eq("id", member_id)
          .maybeSingle();
        if (!m?.user_id) return json(404, { error: "member has no login" });
        const { error } = await admin.auth.admin.updateUserById(m.user_id, {
          password,
        });
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      case "deactivate": {
        const { member_id } = body;
        const { data: m } = await admin
          .from("members")
          .select("user_id")
          .eq("id", member_id)
          .maybeSingle();
        if (!m) return json(404, { error: "member not found" });
        if (m.user_id) await admin.auth.admin.deleteUser(m.user_id);
        const { error } = await admin
          .from("members")
          .update({ active: false, user_id: null })
          .eq("id", member_id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      case "reactivate": {
        const { member_id, password, email } = body;
        if (!password || password.length < 6)
          return json(400, { error: "password min 6 chars" });
        const { data: m } = await admin
          .from("members")
          .select("username")
          .eq("id", member_id)
          .maybeSingle();
        if (!m) return json(404, { error: "member not found" });
        const { data: created, error: authErr } =
          await admin.auth.admin.createUser({
            email: crewEmail(m.username, email),
            password,
            email_confirm: true,
          });
        if (authErr) return json(400, { error: authErr.message });
        const { error } = await admin
          .from("members")
          .update({ active: true, user_id: created.user.id })
          .eq("id", member_id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      case "delete_user": {
        // Hard delete: removes login, member row and all time entries.
        const { member_id } = body;
        const { data: m } = await admin
          .from("members")
          .select("user_id, is_admin")
          .eq("id", member_id)
          .maybeSingle();
        if (!m) return json(404, { error: "member not found" });
        if (m.user_id) await admin.auth.admin.deleteUser(m.user_id);
        const { error } = await admin
          .from("members")
          .delete()
          .eq("id", member_id);
        if (error) return json(400, { error: error.message });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: `unknown action: ${body.action}` });
    }
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
