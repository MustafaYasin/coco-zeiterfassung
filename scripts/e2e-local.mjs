// End-to-end smoke test of COCO Zeit against the LOCAL Supabase stack.
// Needs: supabase start, npm run dev (localhost:5173), Google Chrome.
// Run: npm run test:e2e. Screenshots land in e2e-out/.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = "http://localhost:5173";
const OUT = new URL("../e2e-out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PASSWORD = "coco-test-2026"; // local seed password (scripts/seed-local.mjs)
const sql = (q) =>
  execFileSync("docker", ["exec", "supabase_db_coco-zeiterfassung", "psql", "-U", "postgres", "-Atc", q], {
    encoding: "utf8",
  }).trim();

// Fresh, deterministic test data every run (the seed refuses non-local URLs).
execFileSync("node", [new URL("./seed-local.mjs", import.meta.url).pathname], {
  stdio: "ignore",
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];

async function session(viewport, username) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "de-DE", timezoneId: "Europe/Berlin", acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${username}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${username} console: ${m.text()}`));
  await page.goto(BASE);
  await page.getByLabel("Benutzername oder E-Mail").fill(username);
  await page.getByLabel("Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("heading", { name: /Hallo,/ }).waitFor();
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

// ---------- Admin on iPad landscape ----------
{
  const { context, page } = await session({ width: 1180, height: 820 }, "chef");
  const chefId = sql("select id from members where username='chef'");
  await page.waitForTimeout(600);
  await shot(page, "01-ipad-quer-erfassen");

  const before = Number(sql(`select count(*) from time_entries where member_id='${chefId}'`));
  await page.getByRole("button", { name: "Einstempeln" }).click();
  await page.getByRole("button", { name: "Ausstempeln" }).waitFor();
  const open = Number(sql(`select count(*) from time_entries where member_id='${chefId}' and ended_at is null`));
  check("Einstempeln legt offenen Eintrag an", open === 1, `offen=${open}`);
  await page.waitForTimeout(2200);
  await shot(page, "02-ipad-quer-im-dienst");

  await page.getByRole("button", { name: "Ausstempeln" }).click();
  await page.getByRole("button", { name: "Einstempeln" }).waitFor();
  const openAfter = Number(sql(`select count(*) from time_entries where member_id='${chefId}' and ended_at is null`));
  const after = Number(sql(`select count(*) from time_entries where member_id='${chefId}'`));
  check("Ausstempeln schließt Eintrag", openAfter === 0 && after === before + 1, `offen=${openAfter}, neu=${after - before}`);

  // Nachtragen
  await page.getByRole("button", { name: "Zeit nachtragen" }).click();
  await page.getByLabel("Von").fill("10:00");
  await page.getByLabel("Bis").fill("12:30");
  await page.getByLabel("Pause (min)").fill("15");
  await page.getByLabel("Notiz (optional)").fill("E2E Nachtrag");
  await shot(page, "03-ipad-nachtragen");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByText("E2E Nachtrag").waitFor();
  const row = sql(`select break_minutes, extract(epoch from ended_at-started_at)/60 from time_entries where note='E2E Nachtrag'`);
  check("Nachtragen speichert 150 min mit 15 min Pause", row.replace(/\.0+$/, "") === "15|150", row);

  // Bearbeiten
  const li = page.locator("li", { hasText: "E2E Nachtrag" });
  await li.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await page.getByLabel("Notiz (optional)").fill("E2E geändert");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByText("E2E geändert").waitFor();
  check("Bearbeiten ändert Notiz", sql(`select count(*) from time_entries where note='E2E geändert'`) === "1");

  // Über Mitternacht
  await page.getByRole("button", { name: "Zeit nachtragen" }).click();
  await page.getByLabel("Von").fill("22:00");
  await page.getByLabel("Bis").fill("02:00");
  await page.getByLabel("Notiz (optional)").fill("E2E Nacht");
  const hint = await page.getByText("Endet am nächsten Tag").isVisible();
  check("Hinweis über Mitternacht sichtbar", hint);
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(500);
  check("Nachtschicht = 240 min", sql(`select (extract(epoch from ended_at-started_at)/60)::int from time_entries where note='E2E Nacht'`) === "240");

  // Löschen mit eigenem Dialog: erst abbrechen, dann löschen
  const li2 = page.locator("li", { hasText: "E2E geändert" });
  await li2.getByRole("button", { name: "Löschen", exact: true }).click();
  await shot(page, "04-ipad-loeschen-dialog");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  check("Abbrechen löscht nicht", sql(`select count(*) from time_entries where note='E2E geändert'`) === "1");
  await li2.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
  await page.waitForTimeout(500);
  check("Löschen entfernt Eintrag", sql(`select count(*) from time_entries where note='E2E geändert'`) === "0");

  // Admin: Zeiten + Export
  await page.getByRole("link", { name: "Zeiten" }).click();
  await page.getByRole("heading", { name: "Zeiten" }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, "05-ipad-zeiten");
  for (const [label, ext] of [["Excel (.xlsx)", "xlsx"], ["CSV", "csv"], ["PDF", "pdf"], ["JSON", "json"]]) {
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: label }).click()]);
    const path = `${OUT}export.${ext}`;
    await download.saveAs(path);
    const size = Number(execFileSync("stat", ["-f", "%z", path], { encoding: "utf8" }));
    check(`Export ${ext}`, download.suggestedFilename().endsWith(`.${ext}`) && size > 200, `${download.suggestedFilename()}, ${size} B`);
  }

  await page.getByRole("link", { name: "Auswertung" }).click();
  await page.getByRole("heading", { name: "Auswertung" }).waitFor();
  await page.waitForTimeout(900);
  await shot(page, "06-ipad-auswertung");

  // Monatstabelle pro Person: Werte gegen die Datenbank prüfen
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const expected = sql(
    `select m.display_name || '|' || count(t.id) || '|' || coalesce(sum(round(extract(epoch from t.ended_at - t.started_at) / 60) - t.break_minutes), 0)::int
       from members m join time_entries t on t.member_id = m.id
      where t.ended_at is not null and t.started_at >= '${monthStart.toISOString()}'
      group by m.display_name order by m.display_name`,
  ).split("\n");
  const tableRows = await page.locator("section", { hasText: "Stunden pro Person" }).locator("tbody tr").allInnerTexts();
  const toMinutes = (text) => {
    const [h, m] = text.replace(" h", "").split(":").map(Number);
    return h * 60 + m;
  };
  const shown = tableRows
    .map((row) => row.split("\t").map((cell) => cell.trim()))
    .filter((cells) => Number(cells[1]) > 0)
    .map((cells) => `${cells[0].replace(/\s*ehemalig$/, "")}|${cells[1]}|${toMinutes(cells[2])}`)
    .sort();
  check("Monatstabelle = Datenbank (Person, Schichten, Minuten)", JSON.stringify(shown) === JSON.stringify([...expected].sort()), `${shown.length} Personen`);
  const footer = await page.locator("section", { hasText: "Stunden pro Person" }).locator("tfoot").innerText();
  const kpi = await page.getByText("Teamstunden", { exact: true }).locator("..").innerText();
  check("Gesamtzeile = Teamstunden", footer.includes(kpi.split("\n")[1].trim()), footer.replace(/\s+/g, " "));
  for (const [label, ext] of [["Excel (.xlsx)", "xlsx"], ["PDF", "pdf"]]) {
    await page.locator("section", { hasText: "Stunden pro Person" }).getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: label }).click()]);
    const path = `${OUT}stunden.${ext}`;
    await download.saveAs(path);
    check(`Export Stunden pro Person ${ext}`, download.suggestedFilename().startsWith("coco-stunden-"), download.suggestedFilename());
  }

  // Team: anlegen über die lokale Edge Function, dann deaktivieren
  await page.getByRole("link", { name: "Team" }).click();
  await page.getByRole("heading", { name: "Team" }).waitFor();
  await shot(page, "07-ipad-team");
  await page.getByRole("button", { name: "Neuer Zugang" }).click();
  await page.getByLabel("Benutzername").fill("testneu");
  await page.getByLabel("Anzeigename").fill("Test Neu");
  await page.getByLabel("Passwort (min. 6 Zeichen)").fill("geheim123");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.getByRole("cell", { name: "Test Neu" }).waitFor();
  check("Zugang anlegen (Edge Function)", sql(`select count(*) from members m join auth.users u on u.id=m.user_id where m.username='testneu'`) === "1");
  await page.locator("tr", { hasText: "Test Neu" }).getByRole("button", { name: "Deaktivieren" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Deaktivieren" }).click();
  await page.locator("tr", { hasText: "Test Neu" }).getByText("ehemalig").waitFor();
  check("Deaktivieren entfernt Login, behält Mitglied", sql(`select active::text || '|' || (user_id is null)::text from members where username='testneu'`) === "false|true");

  // Hochformat
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole("link", { name: "Erfassen" }).click();
  await page.waitForTimeout(500);
  await shot(page, "08-ipad-hoch-erfassen");
  await context.close();
}

// ---------- Mitarbeiterin auf dem Handy, Tom eingestempelt ----------
{
  const { context, page } = await session({ width: 393, height: 852 }, "lena");
  await page.waitForTimeout(500);
  await shot(page, "09-handy-lena");
  const nav = await page.getByRole("link", { name: "Zeiten" }).count();
  check("Mitarbeiterin sieht keine Admin-Seiten", nav === 0);
  // Handy: Zeile antippen öffnet Bearbeiten, dort löschen
  const lenaId = sql("select id from members where username='lena'");
  const firstNote = sql(`select count(*) from time_entries where member_id='${lenaId}'`);
  await page.locator("li").first().getByRole("button").first().click();
  await page.getByRole("dialog").getByText("Eintrag bearbeiten").waitFor();
  await shot(page, "09b-handy-bearbeiten");
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Löschen" }).click();
  await page.waitForTimeout(600);
  const afterNote = sql(`select count(*) from time_entries where member_id='${lenaId}'`);
  check("Handy: Zeile antippen, bearbeiten, löschen", Number(afterNote) === Number(firstNote) - 1, `${firstNote} -> ${afterNote}`);
  // RLS: Lena darf Toms Eintrag nicht ändern
  const visible = Number(
    await page.evaluate(async () => {
      const mod = await import("/src/lib/supabase.ts");
      const { data } = await mod.supabase.from("time_entries").select("id, member_id");
      const mine = await mod.supabase.from("members").select("id").eq("username", "lena").single();
      return data.filter((r) => r.member_id !== mine.data.id).length;
    }),
  );
  check("RLS: Lena sieht nur eigene Einträge", visible === 0, `fremde=${visible}`);
  await context.close();
}
{
  const { context, page } = await session({ width: 820, height: 1180 }, "tom");
  await page.waitForTimeout(1200);
  await shot(page, "10-ipad-hoch-tom-im-dienst");
  check("Laufende Schicht wird nach Login erkannt", await page.getByRole("button", { name: "Ausstempeln" }).isVisible());
  await context.close();
}

await browser.close();
console.log(results.join("\n"));
console.log(errors.length ? `\nBrowser-Fehler:\n${errors.join("\n")}` : "\nKeine Browser-Fehler.");
