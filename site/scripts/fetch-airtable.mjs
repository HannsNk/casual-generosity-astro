#!/usr/bin/env node
// Read-only Airtable -> src/data/activities.json pipeline.
// Pulls Published records from Airtable and writes them in the exact shape
// the site already expects. Never writes back to Airtable.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

try {
  await import("dotenv/config");
} catch {
  // dotenv not installed (e.g. CI, where env vars come from the workflow) - fine.
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "activities.json");

const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;

function fail(message) {
  console.error(`[fetch-airtable] ERROR: ${message}`);
  process.exit(1);
}

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  fail(
    "Missing one or more required env vars: AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME."
  );
}

// Maps the free-text "Time Needed" value (Airtable single select) to the
// coarser bucket the site's filters use. Derived from every (time, timeBucket)
// pair that exists in the current activities.json.
const TIME_BUCKETS = new Map([
  ["Under 15 min", "Under 30 min"],
  ["20-30 min", "Under 30 min"],
  ["30 min", "Under 30 min"],
  ["45-60 min", "30-90 min"],
  ["60 min", "30-90 min"],
  ["60 min plus travel", "30-90 min"],
  ["60-90 min", "30-90 min"],
  ["90 min", "90-120 min"],
  ["90-120 min", "90-120 min"],
  ["Half-day", "Half-day"],
]);

function timeBucketFor(time) {
  const bucket = TIME_BUCKETS.get(time);
  if (!bucket) {
    console.warn(
      `[fetch-airtable] WARNING: unrecognised Time Needed value "${time}" - no bucket mapping, leaving timeBucket blank. Add it to TIME_BUCKETS in scripts/fetch-airtable.mjs.`
    );
    return "";
  }
  return bucket;
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Airtable multi-select / lookup fields normally arrive as arrays already.
// Normalise defensively in case a field is configured as single-select or
// plain text instead, so the pipeline never silently drops data.
function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

async function fetchAllRecords() {
  const records = [];
  let offset;
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;

  do {
    const url = new URL(baseUrl);
    url.searchParams.set("filterByFormula", "{Status}='Published'");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      });
    } catch (err) {
      fail(`Network request to Airtable failed: ${err.message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fail(
        `Airtable API request failed with status ${response.status} ${response.statusText}. ${body}`
      );
    }

    const data = await response.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function mapRecord(record, seenSlugs) {
  const f = record.fields;

  const title = asString(f["Title"]).trim();
  if (!title) {
    console.warn(
      `[fetch-airtable] WARNING: skipping record ${record.id} - missing Title.`
    );
    return null;
  }

  let slug = slugify(title);
  if (!slug) {
    console.warn(
      `[fetch-airtable] WARNING: skipping record ${record.id} - Title "${title}" produced an empty slug.`
    );
    return null;
  }
  if (seenSlugs.has(slug)) {
    const base = slug;
    let n = 2;
    while (seenSlugs.has(`${base}-${n}`)) n++;
    slug = `${base}-${n}`;
    console.warn(
      `[fetch-airtable] WARNING: slug collision for "${title}" - using "${slug}" instead.`
    );
  }
  seenSlugs.add(slug);

  const time = asString(f["Time Needed"]).trim();

  return {
    slug,
    title,
    hook: asString(f["Hook"]),
    image: asString(f["Image URL"]),
    tier: asString(f["Tier"]),
    cost: asArray(f["Cost"]),
    time,
    groupSize: asArray(f["Group Size"]),
    location: asArray(f["Location Type"]),
    tags: asArray(f["Category Tags"]),
    needs: f["What You Need"] ? asString(f["What You Need"]) : null,
    why: asString(f["Why This Matters"]),
    instructions: asString(f["Instructions"]),
    link: asString(f["Org / Link"]),
    timeBucket: time ? timeBucketFor(time) : "",
  };
}

async function main() {
  console.log(
    `[fetch-airtable] Fetching Published records from base ${AIRTABLE_BASE_ID}, table "${AIRTABLE_TABLE_NAME}"...`
  );

  const records = await fetchAllRecords();

  if (records.length === 0) {
    fail(
      "Airtable returned zero records for filterByFormula={Status}='Published'. Refusing to overwrite activities.json with an empty list."
    );
  }

  console.log(`[fetch-airtable] Fetched ${records.length} raw record(s).`);

  const seenSlugs = new Set();
  const activities = records
    .map((record) => mapRecord(record, seenSlugs))
    .filter(Boolean);

  if (activities.length === 0) {
    fail("Every fetched record was skipped (missing required fields). Nothing to write.");
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(activities, null, 1) + "\n", "utf-8");

  console.log(
    `[fetch-airtable] Wrote ${activities.length} activities to ${path.relative(process.cwd(), OUTPUT_PATH)}.`
  );
}

main().catch((err) => {
  fail(err.stack || err.message);
});
