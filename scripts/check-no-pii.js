"use strict";

/**
 * Fail if any tracked file contains a raw rider_id from the sheet.
 * Loads data/feedback.csv (fetches from Cityflo bundle if missing).
 *
 *   node scripts/check-no-pii.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { parseCsv } = require("../lib/csv");
const { request } = require("../lib/http");

const ROOT = path.join(__dirname, "..");
const CSV = path.join(ROOT, "data", "feedback.csv");
const BUNDLE =
  "https://careers.cityflo.com/takehomes/product-engineer/data/feedback.csv";

async function ensureCsv() {
  const dir = path.dirname(CSV);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(CSV) && fs.statSync(CSV).size > 0) return;
  const res = await request(BUNDLE);
  if (!res.ok) throw new Error(`fetch CSV HTTP ${res.status}`);
  fs.writeFileSync(CSV, await res.text());
  console.log("fetched feedback.csv from bundle");
}

function trackedFiles() {
  const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

async function main() {
  await ensureCsv();
  const rows = parseCsv(fs.readFileSync(CSV, "utf8"));
  const ids = [
    ...new Set(rows.map((r) => (r.rider_id || "").trim()).filter(Boolean)),
  ];
  console.log(`sheet rider_ids: ${ids.length}`);

  const files = trackedFiles();
  console.log(`tracked files: ${files.length}`);

  let failed = 0;
  const hits = [];
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const id of ids) {
      if (text.includes(id)) {
        failed += 1;
        hits.push({ file: rel, id });
        console.log(`FAIL ${rel} contains ${id}`);
      }
    }
  }

  if (failed === 0) {
    console.log("PASS: zero sheet rider_ids in tracked files");
  } else {
    console.log(`FAILED ${failed} hit(s)`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
