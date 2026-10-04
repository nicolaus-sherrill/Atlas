// Applies every migration to an in-memory Postgres with stand-ins for Supabase's auth schema,
// then checks what an anonymous visitor and an admin can and cannot do.
//   pnpm --filter @workspace/scripts run test-db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";
const M = path.resolve(import.meta.dirname, "../../supabase/migrations") + "/";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create schema extensions;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  -- Supabase grants service_role full table rights by default; mirror that for tables made later
  alter default privileges in schema public grant all on tables to service_role;
  grant execute on all functions in schema auth to anon, authenticated;
`);
for (const f of readdirSync(M).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(M + f, "utf8"));

let failures = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`); if (!cond) failures++; };
const rows = async (sql, p) => (await db.query(sql, p)).rows;
const throws = async (sql, p) => { try { await db.query(sql, p); return null; } catch (e) { return e.message; } };

async function asAnon(ip = "1.2.3.4") {
  await db.exec(`reset role; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','{"cf-connecting-ip":"${ip}"}',false); set role anon;`);
}
const adminId = "11111111-1111-1111-1111-111111111111";
async function asAdmin() {
  await db.exec(`reset role; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','${adminId}',false); set role authenticated;`);
}
await db.exec(`insert into auth.users values ('${adminId}'); insert into private.admins (user_id) values ('${adminId}');`);

const scores = `'{"wifi":3,"outlets":3,"food":3,"atmosphere":3,"hours":3,"access":3}'::jsonb`;
const newSpot = (name, extra = "") => `insert into public.spots (name, category, lat, lng, scores${extra ? ", ai_summary" : ""}) values ('${name}', 'cafe', 30.27, -97.74, ${scores}${extra})`;

await asAnon();
ok("anon sees 13 starter spots", (await rows("select count(*)::int n from public.spots"))[0].n === 13);
await db.query(newSpot("Sneaky", ", 'fake summary'"));
const sneaky = (await rows("select ai_summary, id from public.spots where name='Sneaky'"))[0];
ok("anon can't set an AI summary", sneaky && sneaky.ai_summary === null);
ok("bad scores rejected", !!(await throws(`insert into public.spots (name, category, lat, lng, scores) values ('Bad', 'cafe', 30, -97, '{"wifi":9}'::jsonb)`)));
ok("bad tag rejected", !!(await throws(`insert into public.spots (name, category, lat, lng, scores, tags) values ('Bad', 'cafe', 30, -97, ${scores}, array['free_money'])`)));
await throws("update public.spots set name='Hacked' where id='seed-1'");
ok("anon can't edit a spot directly", (await rows("select name from public.spots where id='seed-1'"))[0].name !== "Hacked");
await throws("delete from public.spots where id='seed-2'");
ok("anon can't delete a spot", (await rows("select count(*)::int n from public.spots where id='seed-2'"))[0].n === 1);
await db.query(`insert into public.spot_edits (spot_id, changes, note) values ('seed-3', '{"name":"Mañana Cafe","description":"Now open later"}', 'renamed')`);
ok("anon can suggest an edit", true);
const denied = async (sql) => { const e = await throws(sql); return !!e || (await rows(sql)).length === 0; };
ok("anon can't read the edit queue", await denied("select * from public.spot_edits"));
ok("edit with unknown field rejected", !!(await throws(`insert into public.spot_edits (spot_id, changes) values ('seed-3', '{"status":"removed"}')`)));
await db.query(`insert into public.spot_reports (spot_id, reason, details) values ('seed-4', 'closed', 'Shut down last month')`);
ok("anon can report a problem", true);
await db.query(`insert into public.crowd_reports (spot_id, level) values ('seed-1', 3), ('seed-1', 4)`);
ok("anon can't read raw crowd reports", await denied("select * from public.crowd_reports"));
const all = (await rows("select public.crowd_status_all() s"))[0].s;
ok("crowd status aggregate", all["seed-1"]?.level === 4 && all["seed-1"]?.reportCount === 2, JSON.stringify(all["seed-1"]));
const one = (await rows("select public.crowd_status('seed-1') s"))[0].s;
ok("crowd status per spot", one.current?.label === "Very busy" && one.hourlyAverages.length === 1, JSON.stringify(one));
ok("anon can't review edits", !!(await throws("select public.review_spot_edit((select id from public.spot_edits limit 1), true)")));

// Rate limit: 10 spots per hour per visitor. "Sneaky" was #1 from this IP.
let limited = null;
for (let i = 2; i <= 11 && !limited; i++) limited = await throws(newSpot(`Flood ${i}`)) && i;
ok("11th spot in an hour from one visitor is blocked", limited === 11, `blocked at #${limited}`);
await asAnon("5.6.7.8");
ok("a different visitor is unaffected", !(await throws(newSpot("Other visitor"))));

await asAdmin();
const edit = (await rows("select id from public.spot_edits where status='pending'"))[0];
ok("admin sees the edit queue", !!edit);
ok("admin sees the report queue", (await rows("select count(*)::int n from public.spot_reports where status='open'"))[0].n === 1);
const before = (await rows("select tags from public.spots where id='seed-3'"))[0].tags;
await db.query("select public.review_spot_edit($1, true)", [edit.id]);
const after = (await rows("select name, description, tags, ai_summary from public.spots where id='seed-3'"))[0];
ok("approved edit applied", after.name === "Mañana Cafe" && after.description === "Now open later");
ok("untouched fields kept (tags)", JSON.stringify(after.tags) === JSON.stringify(before));
ok("stale AI summary cleared", after.ai_summary === null);
// ---------- delete, archive, restore ----------
await asAnon("9.9.9.9");
await db.query(`insert into public.crowd_reports (spot_id, level) values ('seed-4', 2)`);
await db.query(`insert into public.spot_reports (spot_id, reason) values ('seed-4', 'closed')`);
await throws("delete from public.spots where id='seed-4'");
const count4 = async () => (await rows("select count(*)::int n from public.spots where id='seed-4'"))[0].n;
ok("anon can't delete a spot", (await count4()) === 1);
ok("anon can't list deleted spots", !!(await throws("select * from public.list_deleted_spots()")));
await asAdmin();
const before4 = (await rows("select scores, rating_count, created_at from public.spots where id='seed-4'"))[0];
const reports4 = async () => (await rows("select count(*)::int n from public.spot_reports where spot_id='seed-4'"))[0].n;
const reportsBefore = await reports4();
const crowdAt = (await rows("select reported_at from public.crowd_reports where spot_id='seed-4'"))[0].reported_at;
await db.query("delete from public.spots where id='seed-4'");
ok("admin can delete", (await count4()) === 0);
ok("delete takes ratings and reports with it",
  (await rows("select (select count(*) from public.ratings where spot_id='seed-4') + (select count(*) from public.spot_reports where spot_id='seed-4') + (select count(*) from public.crowd_reports where spot_id='seed-4') n"))[0].n == 0);
const archived = await rows("select * from public.list_deleted_spots()");
ok("deleted spot is archived", archived.length === 1 && archived[0].spot_id === "seed-4" && archived[0].rating_count === 1, JSON.stringify(archived));
await asAnon("9.9.9.8");
ok("anon can't restore", !!(await throws(`select public.restore_spot(${archived[0].id})`)));
ok("crowd report on a deleted spot refused", !!(await throws(`insert into public.crowd_reports (spot_id, level) values ('seed-4', 2)`)));
await asAdmin();
const restoreErr = await throws(`select public.restore_spot(${archived[0].id})`);
const after4 = (await rows("select scores, rating_count, created_at from public.spots where id='seed-4'"))[0];
ok("admin can restore", !restoreErr && !!after4, restoreErr ?? "");
ok("restore keeps scores, rating count and dates", after4 && JSON.stringify(after4) === JSON.stringify(before4), JSON.stringify(after4));
ok("restore brings back the reports", reportsBefore === 2 && (await reports4()) === reportsBefore);
ok("restore keeps crowd report times",
  (await rows("select reported_at from public.crowd_reports where spot_id='seed-4'"))[0]?.reported_at?.getTime() === crowdAt.getTime());
ok("restore empties the archive entry", (await rows("select * from public.list_deleted_spots()")).length === 0);
await db.query("delete from public.spots where id='seed-4'");
const rearchived = (await rows("select id from public.list_deleted_spots()"))[0];
await db.query(`insert into public.spots (id, name, category, lat, lng, scores) values ('seed-4', 'Taken', 'cafe', 30, -97, ${scores})`);
ok("restore refused when the spot is back", !!(await throws(`select public.restore_spot(${rearchived.id})`)));
await db.query("delete from public.spots where id='seed-4'");


await asAnon("8.8.8.8");
const osmSpot = (name) => `insert into public.spots (name, category, lat, lng, scores, website, osm_type, osm_id) values ('${name}', 'cafe', 30.27, -97.74, ${scores}, 'https://example.com', 'node', 8958597038)`;
ok("spot linked to an OpenStreetMap place saves", !(await throws(osmSpot("Café Crème"))));
ok("same real place can't be added twice", !!(await throws(osmSpot("Café Crème again"))));
ok("non-web website rejected", !!(await throws(`insert into public.spots (name, category, lat, lng, scores, website) values ('Bad site', 'cafe', 30, -97, ${scores}, 'javascript:alert(1)')`)));
ok("half an OpenStreetMap link rejected", !!(await throws(`insert into public.spots (name, category, lat, lng, scores, osm_type) values ('Half', 'cafe', 30, -97, ${scores}, 'node')`)));
ok("website edit can be suggested", !(await throws(`insert into public.spot_edits (spot_id, changes) values ('seed-1', '{"website":"https://codependentaustin.com"}')`)));
ok("edit can't change the OpenStreetMap link", !!(await throws(`insert into public.spot_edits (spot_id, changes) values ('seed-1', '{"osm_id":1}')`)));
// ---------- clearing fields through edits ----------
await asAnon("11.0.0.1");
ok("edit can mark hours unknown", !(await throws(`insert into public.spot_edits (spot_id, changes, note) values ('seed-5', '{"operating_hours":null,"website":""}', 'clear-test')`)));
ok("edit can't set a non-web website", !!(await throws(`insert into public.spot_edits (spot_id, changes) values ('seed-5', '{"website":"ftp://x"}')`)));
await asAdmin();
const clearEdit = (await rows("select id from public.spot_edits where note='clear-test'"))[0];
await db.exec("reset role; update public.spots set website='https://old.example' where id='seed-5'");
await asAdmin();
ok("approving a clearing edit succeeds", !(await throws("select public.review_spot_edit($1, true)", [clearEdit.id])));
await db.exec("reset role");
const cleared = (await rows("select operating_hours, website from public.spots where id='seed-5'"))[0];
ok("hours and website are cleared to real nulls", cleared.operating_hours === null && cleared.website === null, JSON.stringify(cleared));

// ---------- ratings ----------
const raterA = "aaaaaaaa-0000-0000-0000-00000000000a";
const raterB = "bbbbbbbb-0000-0000-0000-00000000000b";
await db.exec(`reset role; insert into auth.users values ('${raterA}'), ('${raterB}');`);
async function asRater(id, ip) {
  await db.exec(`reset role; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','${id}',false), set_config('request.headers','{"cf-connecting-ip":"${ip}"}',false); set role authenticated;`);
}
const rate = (spot, w) => `insert into public.ratings (spot_id, scores) values ('${spot}', '{"wifi":${w},"outlets":3,"food":3,"atmosphere":3,"hours":3,"access":3}'::jsonb)
  on conflict (spot_id, user_id) do update set scores = excluded.scores`;
const spotRow = async (id) => { await db.exec("reset role"); const r = (await rows(`select scores, rating_count from public.spots where id='${id}'`))[0]; return r; };

ok("starter spots start with one rating each", (await spotRow("seed-1")).rating_count === 1);
const starterWifi = Number((await spotRow("seed-1")).scores.wifi);
await asRater(raterA, "10.0.0.1");
ok("a visitor can rate an existing spot", !(await throws(rate("seed-1", 1))));
let r1 = await spotRow("seed-1");
ok("spot scores become the average", r1.rating_count === 2 && Number(r1.scores.wifi) === Math.round(((starterWifi + 1) / 2) * 10) / 10, JSON.stringify(r1));
await asRater(raterA, "10.0.0.1");
ok("rating again replaces the earlier rating", !(await throws(rate("seed-1", 5))) && (await spotRow("seed-1")).rating_count === 2);
await asRater(raterB, "10.0.0.2");
await db.query(rate("seed-1", 5));
ok("a rater can't see someone else's rating", (await rows("select * from public.ratings where spot_id='seed-1'")).length === 1);
await db.query("update public.ratings set status='hidden' where spot_id='seed-1'");
ok("a rater can't hide ratings", (await spotRow("seed-1")).rating_count === 3);
await asRater(raterB, "10.0.0.2");
ok("a rater can't moderate", !!(await throws(`select public.set_rater_ratings_status('${raterA}', 'hidden')`)));
ok("an anonymous visitor without a session can't rate", await (async () => { await asAnon("10.0.0.3"); return !!(await throws(rate("seed-2", 4))); })());
await asRater(raterB, "10.0.0.2");
ok("scores can no longer be changed through a suggested edit", !!(await throws(`insert into public.spot_edits (spot_id, changes) values ('seed-2', '{"scores":{"wifi":5,"outlets":5,"food":5,"atmosphere":5,"hours":5,"access":5}}')`)));
await db.query(`insert into public.spots (name, category, lat, lng, scores) values ('Rated On Arrival', 'library', 30.2, -97.7, '{"wifi":4,"outlets":4,"food":2,"atmosphere":5,"hours":3,"access":4}')`);
const arrival = (await rows("select id from public.spots where name='Rated On Arrival'"))[0].id;
ok("adding a spot gives it its first rating", (await spotRow(arrival)).rating_count === 1);
await asRater(raterB, "10.0.0.2");
ok("the adder sees their first rating as their own", (await rows(`select * from public.ratings where spot_id='${arrival}'`)).length === 1);
await asAdmin();
ok("admin sees every rating", (await rows("select * from public.ratings where spot_id='seed-1'")).length === 3);
const hidden = (await rows(`select public.set_rater_ratings_status('${raterB}', 'hidden') n`))[0].n;
ok("admin hides all of one rater's ratings", hidden === 2, `hid ${hidden}`);
r1 = await spotRow("seed-1");
ok("hidden ratings leave the average", r1.rating_count === 2 && Number(r1.scores.wifi) === Math.round(((starterWifi + 5) / 2) * 10) / 10, JSON.stringify(r1));
await asAdmin();
await db.query(`select public.set_rater_ratings_status('${raterB}', 'visible')`);
ok("restoring brings them back", (await spotRow("seed-1")).rating_count === 3);
await asRater(raterA, "10.0.0.1");
await db.query("delete from public.ratings where spot_id='seed-1'");
ok("a rater can withdraw their own rating", (await spotRow("seed-1")).rating_count === 2);

// ---------- server key ----------
await db.exec(`reset role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false); set role service_role;`);
const serverWrite = await throws("update public.spots set ai_summary = 'server test' where id = 'seed-2'");
await db.exec("reset role");
ok("server key can save an AI summary", !serverWrite && (await rows("select ai_summary from public.spots where id='seed-2'"))[0].ai_summary === "server test", serverWrite ?? "");

await asAnon("7.7.7.7");
ok("anon can't read admins table", !!(await throws("select * from private.admins")));
ok("anon can't read rate limits", !!(await throws("select * from private.rate_limits")));
ok("anon can't read the deleted-spot archive", !!(await throws("select * from private.deleted_spots")));
console.log(failures ? `${failures} FAILED` : "Private tables locked");
process.exit(failures ? 1 : 0);
