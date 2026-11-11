// Makes atlas-dev a copy of the spots that are live on Atlas, so testing happens on real data
// without touching it.
//   pnpm --filter @workspace/scripts run sync-dev
//
// It reads the live spots with the site's public key, which can only read. It then replaces every
// spot on atlas-dev with them, through the Supabase command-line tool, which must be signed in.
// Everything on atlas-dev that hangs off a spot (ratings, reviews, edits, reports, crowd reports)
// is cleared, and each spot gets one starter rating from its live scores. Live ratings and reviews
// are not copied: the public key can't read who gave them.
//
// It can only ever write to atlas-dev: the project it pushes to is fixed below, and any migration
// atlas-dev is missing goes with the push.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEV_REF = "beuzylmefetngeeyytog";
const SUPABASE = ["--yes", "supabase@3.1.0"];
const root = path.resolve(import.meta.dirname, "../..");
const work = path.join(root, ".dev-sync");

const env = Object.fromEntries(
  readFileSync(path.join(root, "artifacts/atlas/.env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
if (env.VITE_SUPABASE_URL.includes(DEV_REF)) throw new Error("artifacts/atlas/.env points at atlas-dev; it should be the live project.");

const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/spots?select=*&order=created_at.asc`, {
  headers: { apikey: key, authorization: `Bearer ${key}` },
});
if (!res.ok) throw new Error(`Couldn't read the live spots: ${res.status}`);
const spots = await res.json();
if (!Array.isArray(spots) || spots.length === 0) throw new Error("The live site returned no spots; leaving atlas-dev as it is.");

const text = (v) => (v == null ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const json = (v) => (v == null ? "null" : `${text(JSON.stringify(v))}::jsonb`);
const list = (v) => `array[${(v ?? []).map(text).join(", ")}]::text[]`;

// Once the live site is on 2.0 its rows carry these; until then atlas-dev's defaults apply
const live2 = "good_for" in spots[0];
const columns = ["id", "name", "category", "city", "address", "lat", "lng", "timezone", "scores", "tags", "description", "ai_summary", "operating_hours", "website", "osm_type", "osm_id", "created_at", "updated_at"];
if (live2) columns.push("good_for", "paid_entry");

const row = (s) =>
  `(${[
    text(s.id), text(s.name), text(s.category), text(s.city), text(s.address), s.lat, s.lng, text(s.timezone ?? "America/Chicago"),
    json(s.scores), list(s.tags), text(s.description), text(s.ai_summary), json(s.operating_hours), text(s.website), text(s.osm_type), s.osm_id ?? "null",
    text(s.created_at), text(s.updated_at),
    ...(live2 ? [list(s.good_for), s.paid_entry ? "true" : "false"] : []),
  ].join(", ")})`;

const seed = `-- Live spots copied to atlas-dev, ${new Date().toISOString()}
begin;
truncate public.spots cascade;
insert into public.spots (${columns.join(", ")}) values
${spots.map(row).join(",\n")};
${
  live2
    ? ""
    : `-- The live site is still on 1.x, so repeat what the 2.0 migrations do to its data
update public.spots set category = 'hotel', good_for = '{work,gather}' where name = 'The Carpenter Hotel' and category = 'cafe';
update public.spots set category = 'bookstore' where name = 'First Light Book Shop' and category = 'cafe';
update public.ratings r set scores = r.scores - 'food' from public.spots s
  where s.id = r.spot_id and s.category not in ('cafe', 'bar', 'food_hall') and (r.scores ->> 'food')::numeric = 1;
`
}select private.recompute_spot_scores(id) from public.spots;
commit;
`;

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(path.join(root, "supabase"), path.join(work, "supabase"), { recursive: true, filter: (src) => !src.includes(`${path.sep}.temp`) });
writeFileSync(path.join(work, "supabase/seed.sql"), seed);

const run = (args) => execFileSync("npx", [...SUPABASE, ...args], { cwd: work, stdio: "inherit" });
run(["link", "--project-ref", DEV_REF]);
run(["db", "push", `--remote=${DEV_REF}`, "--include-seed", "--yes"]);
rmSync(work, { recursive: true, force: true });
console.log(`atlas-dev now holds the ${spots.length} live spots.`);
