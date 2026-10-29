// Lokaler Test von schema.sql + seed.sql mit PGlite (Postgres im Prozess).
// Bildet die Supabase-Teile nach, die das Schema braucht: auth.users, auth.uid(), auth.jwt(), Rollen anon/authenticated.
// Aufruf: node webapp/supabase/test.mjs   (PGlite muss auflösbar sein, z. B. NODE_PATH auf ein node_modules mit @electric-sql/pglite)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const db = new PGlite();
let failed = 0;
const ok = (cond, label) => { console.log((cond ? "  ok   " : "  FAIL ") + label); if (!cond) failed++; };
async function throws(fn, label, match) {
  try { await fn(); ok(false, label + " (kein Fehler)"); }
  catch (e) { ok(!match || String(e.message).includes(match), label + " → " + e.message.split("\n")[0]); }
}

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);
await db.exec(readFileSync(path.join(dir, "schema.sql"), "utf8"));
await db.exec(readFileSync(path.join(dir, "seed.sql"), "utf8"));
await db.exec(readFileSync(path.join(dir, "seed.sql"), "utf8")); // zweimal: muss idempotent sein

const count = async (t) => (await db.query(`select count(*)::int n from ${t}`)).rows[0].n;
console.log("Startdaten");
ok(await count("public.catalog") === 24, "24 Titel");
ok(await count("public.participants") === 24, "23 Broker + Back Office");
ok(await count("public.challenges") === 5, "5 Challenges");

// Anmeldungen simulieren (wie Supabase Auth: Insert in auth.users als Service)
console.log("Anmeldung");
await throws(() => db.query("insert into auth.users (email) values ('fremd@example.com')"), "Unbekannte E-Mail wird abgewiesen", "nicht freigeschaltet");
await db.query("update public.participants set email = 'tom@example.com' where id = 'tom-ranft'");
await db.query("update public.participants set email = 'david@example.com' where id = 'david-wengler'");
const admin = (await db.query("insert into auth.users (email) values ('ARNDT@vertriebsbildungszentrum.de') returning id")).rows[0].id;
const tom = (await db.query("insert into auth.users (email) values ('tom@example.com') returning id")).rows[0].id;
const david = (await db.query("insert into auth.users (email) values ('david@example.com') returning id")).rows[0].id;
ok((await db.query("select user_id from public.participants where id = 'tom-ranft'")).rows[0].user_id === tom, "Konto wird automatisch mit dem Broker verknüpft");

async function as(uid, email, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)", [uid || "", email || ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const q = (sql, p) => db.query(sql, p).then(r => r.rows);

console.log("Rechte als Vertriebler (Tom)");
await as(tom, "tom@example.com", async () => {
  ok((await q("select public.my_pid() p"))[0].p === "tom-ranft", "my_pid() = tom-ranft");
  ok((await q("select public.is_admin() a"))[0].a === false, "kein Admin");
  ok((await q("select count(*)::int n from public.catalog"))[0].n === 24, "sieht den Katalog");
  await throws(() => q("select email from public.participants"), "sieht keine E-Mails", "permission denied");
  ok((await q("select count(*)::int n from public.participants"))[0].n === 24, "sieht alle Broker-Namen");
  await throws(() => q("insert into public.ledger (participant_id, delta, reason) values ('tom-ranft', 5000, 'Selbstbedienung')"), "kann sich keine Punkte buchen", "row-level security");
  // RLS blendet die Zeile beim Update aus: kein Fehler, aber 0 geänderte Zeilen
  ok((await db.query("update public.catalog set points = 1 where id = 'caviar'")).affectedRows === 0, "kann keine Preise ändern (0 Zeilen)");
  ok((await q("select count(*)::int n from public.catalog where points = 1"))[0].n === 0, "Preis blieb unverändert");
  ok((await db.query("delete from public.ledger")).affectedRows === 0, "kann keine Buchungen löschen (0 Zeilen)");
  await throws(() => q("select public.redeem('caviar', 'L', null, null)"), "Einlösen ohne Punkte scheitert", "Nicht genug");
  await throws(() => q("select public.admin_participants()"), "keine Admin-Liste", "Nur das Back Office");
  await throws(() => q("select public.redeem('caviar', 'L', null, 'david-wengler')"), "kann nicht für andere ordern", "Nur das Back Office");
});

console.log("Back Office bucht Punkte");
await as(admin, "arndt@vertriebsbildungszentrum.de", async () => {
  ok((await q("select public.is_admin() a"))[0].a === true, "Admin erkannt (E-Mail ohne Groß/Klein-Unterschied)");
  await q("insert into public.ledger (participant_id, delta, reason) values ('tom-ranft', 1100, 'Test')");
  ok((await q("select count(*)::int n from public.admin_participants() where email is not null"))[0].n === 3, "Admin sieht E-Mails");
});

console.log("Einlösen als Tom");
let o1, o2;
await as(tom, "tom@example.com", async () => {
  o1 = (await q("select public.redeem('caviar', 'L', 'Büro Berlin', null) id"))[0].id;
  ok(!!o1, "Caviar (400) eingelöst");
  ok((await q("select public.available_points('tom-ranft') n"))[0].n === 700, "700 frei, 400 reserviert");
  o2 = (await q("select public.redeem('bgs-salary', 'XL', null, null) id"))[0].id;
  ok((await q("select public.available_points('tom-ranft') n"))[0].n === 0, "nach BGS (700) 0 frei");
  await throws(() => q("select public.redeem('red-flag', 'M', null, null)"), "kein Überziehen möglich", "Nicht genug");
  await throws(() => q("select public.set_order_status($1, 'freigegeben')", [o1]), "kann eigene Order nicht freigeben", "Nur das Back Office");
  await q("select public.cancel_order($1)", [o2]);
  ok((await q("select public.available_points('tom-ranft') n"))[0].n === 700, "Storno gibt Punkte frei");
  ok((await q("select count(*)::int n from public.orders"))[0].n === 1, "sieht nur eigene Orders");
});
await as(david, "david@example.com", async () => {
  ok((await q("select count(*)::int n from public.orders"))[0].n === 0, "David sieht Toms Order nicht");
  await throws(() => q("select public.cancel_order($1)", [o1]), "David kann Toms Order nicht stornieren", "nicht mehr storniert");
});

console.log("Freigabe und Druck");
await as(admin, "arndt@vertriebsbildungszentrum.de", async () => {
  await throws(() => q("select public.set_order_status($1, 'geliefert')", [o1]), "offen → geliefert gesperrt", "nicht erlaubt");
  await q("select public.set_order_status($1, 'freigegeben')", [o1]);
  ok((await q("select sum(delta)::int s from public.ledger where participant_id = 'tom-ranft'"))[0].s === 700, "Abbuchung -400 im Konto");
  ok((await q("select sold from public.catalog where id = 'caviar'"))[0].sold === 1, "Verkaufszähler +1");
  ok((await q("select public.mark_ordered(array[$1]::uuid[]) n", [o1]))[0].n === 1, "als bestellt markiert");
  await q("select public.set_order_status($1, 'geliefert')", [o1]);
  ok((await q("select status from public.orders where id = $1", [o1]))[0].status === "geliefert", "Status geliefert");
});

console.log("Limitierte Stückzahl");
await as(admin, "arndt@vertriebsbildungszentrum.de", async () => {
  await q("update public.catalog set stock = 1 where id = 'king-of-afa'");
  await q("insert into public.ledger (participant_id, delta, reason) values ('david-wengler', 3000, 'Test')");
});
await as(david, "david@example.com", async () => {
  await q("select public.redeem('king-of-afa', 'L', null, null)");
  await throws(() => q("select public.redeem('king-of-afa', 'M', null, null)"), "zweites Stück bei Bestand 1 gesperrt", "Ausverkauft");
});

console.log("Nicht angemeldet");
await as(null, null, async () => {
  await throws(() => q("select count(*) from public.catalog"), "anon sieht nichts", "permission denied");
});

console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : "\nAlle Tests bestanden");
process.exit(failed ? 1 : 0);
