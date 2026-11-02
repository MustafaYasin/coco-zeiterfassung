// Seeds the LOCAL Supabase stack (supabase start) with invented test data.
// Usage: npm run seed:local
// Refuses to run against anything but localhost, so live data stays untouched.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Local-only test password for every seeded login.
export const TEST_PASSWORD = "coco-test-2026";

const status = Object.fromEntries(
  execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const url = status.API_URL;
const serviceKey = status.SERVICE_ROLE_KEY;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  throw new Error(`Refusing to seed non-local Supabase: ${url}`);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const people = [
  { username: "chef", display_name: "Chefin Test", is_admin: true },
  { username: "lena", display_name: "Lena" },
  { username: "tom", display_name: "Tom" },
  { username: "mira", display_name: "Mira" },
  { username: "jonas", display_name: "Jonas" },
  { username: "alex", display_name: "Alex", former: true },
];

// Wipe previous seed (cascades to time entries).
await db.from("members").delete().neq("username", "");
const { data: oldUsers } = await db.auth.admin.listUsers();
for (const user of oldUsers?.users ?? []) await db.auth.admin.deleteUser(user.id);

const members = [];
for (const person of people) {
  let userId = null;
  if (!person.former) {
    const { data, error } = await db.auth.admin.createUser({
      email: `${person.username}@crew.coco-munich.de`,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }
  const { data, error } = await db
    .from("members")
    .insert({
      user_id: userId,
      username: person.username,
      display_name: person.display_name,
      is_admin: !!person.is_admin,
      active: !person.former,
    })
    .select()
    .single();
  if (error) throw error;
  members.push(data);
}

// Deterministic pseudo-random shifts over the last ~100 days.
let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const notes = ["", "", "", "Inventur", "Lieferung angenommen", "Bar", "Küche"];
const entries = [];
const today = new Date();
for (const member of members) {
  for (let day = 100; day >= 1; day--) {
    if (rand() > 0.42) continue;
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    const lunch = rand() < 0.35;
    start.setHours(lunch ? 11 : 17, rand() < 0.5 ? 0 : 30, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 240 + Math.round(rand() * 6) * 30);
    entries.push({
      member_id: member.id,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      break_minutes: rand() < 0.3 ? 30 : 0,
      note: notes[Math.floor(rand() * notes.length)],
      source: day > 60 ? "import" : "app",
    });
  }
}
// Tom is clocked in right now.
const tom = members.find((member) => member.username === "tom");
const running = new Date(Date.now() - 2.5 * 3600_000);
entries.push({
  member_id: tom.id,
  started_at: running.toISOString(),
  ended_at: null,
  break_minutes: 0,
  note: "",
  source: "app",
});

const { error } = await db.from("time_entries").insert(entries);
if (error) throw error;
console.log(`Seeded ${members.length} members, ${entries.length} entries at ${url}`);
console.log(`Logins: chef (admin), lena, tom, mira, jonas · password ${TEST_PASSWORD}`);
