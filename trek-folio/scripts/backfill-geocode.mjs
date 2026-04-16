#!/usr/bin/env node
/**
 * Backfill: geocode every reservation that has an address but no lat/lng.
 *
 * Usage (from the trek-folio/ directory):
 *   node scripts/backfill-geocode.mjs            # dry run
 *   node scripts/backfill-geocode.mjs --apply    # write results
 *
 * Reads from trek-folio/.env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (required; RLS bypass for bulk update)
 *   - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  (or GOOGLE_MAPS_API_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Simple .env.local loader — avoids a runtime dep.
function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^['"]|['"]$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  } catch {
    // ignore — env may come from the shell
  }
}
loadEnvLocal();

const apply = process.argv.includes("--apply");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}
if (!MAPS_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY) in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function geocode(address) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", MAPS_KEY);
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    return { ok: false, reason: json.status, error: json.error_message };
  }
  const top = json.results[0];
  return {
    ok: true,
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    place_id: top.place_id ?? null,
    formatted: top.formatted_address,
  };
}

const { data: rows, error } = await supabase
  .from("reservations")
  .select("id, address, lat, lng")
  .not("address", "is", null)
  .is("lat", null);

if (error) {
  console.error("Query failed:", error);
  process.exit(1);
}

console.log(
  `Found ${rows.length} reservation(s) with an address but no coordinates.`
);
if (rows.length === 0) process.exit(0);
if (!apply) {
  console.log("Dry run — re-run with --apply to write results.\n");
}

let ok = 0;
let failed = 0;
for (const row of rows) {
  const result = await geocode(row.address);
  if (!result.ok) {
    console.log(`  × ${row.id}  "${row.address}"  [${result.reason}]`);
    failed++;
    continue;
  }
  console.log(
    `  ✓ ${row.id}  "${row.address}"  →  ${result.lat.toFixed(5)},${result.lng.toFixed(5)}`
  );
  if (apply) {
    const { error: updErr } = await supabase
      .from("reservations")
      .update({
        lat: result.lat,
        lng: result.lng,
        google_place_id: result.place_id,
      })
      .eq("id", row.id);
    if (updErr) {
      console.log(`    update failed: ${updErr.message}`);
      failed++;
      continue;
    }
  }
  ok++;
  // Gentle rate limit — Google allows ~50 qps but we don't need to rush.
  await new Promise((r) => setTimeout(r, 120));
}

console.log(
  `\nDone — ${ok} geocoded, ${failed} failed${apply ? ", writes applied" : " (dry run)"}.`
);
