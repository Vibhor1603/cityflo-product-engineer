"use strict";

const fs = require("fs");
const path = require("path");
const { redactPii } = require("../lib/classify");
const { parseCsv } = require("../lib/csv");

const CSV = path.join(__dirname, "..", "data", "feedback.csv");
const BUNDLE =
  "https://careers.cityflo.com/takehomes/product-engineer/data/feedback.csv";

function loadSheetIds() {
  if (!fs.existsSync(CSV)) return new Set();
  const rows = parseCsv(fs.readFileSync(CSV, "utf8"));
  return new Set(
    rows.map((r) => (r.rider_id || "").trim()).filter(Boolean)
  );
}

/** Obviously fake; assert absent from the sheet before using. */
const FAKE_RIDER = "R-99901";
const FAKE_PHONE = "0000000000";
const FAKE_EMAIL = "nobody@example.invalid";

const sheetIds = loadSheetIds();
if (sheetIds.has(FAKE_RIDER)) {
  console.error("FAIL: FAKE_RIDER unexpectedly present in feedback.csv:", FAKE_RIDER);
  process.exit(1);
}
console.log("FAKE_RIDER absent from sheet:", FAKE_RIDER);

const samples = [
  `call me at ${FAKE_PHONE} about booking ${FAKE_RIDER}`,
  `email ${FAKE_EMAIL} please`,
  "normal feedback with no pii here",
];

let fail = 0;
for (const s of samples) {
  const out = redactPii(s);
  const ok =
    s === samples[2]
      ? out === s
      : out.includes("[redacted]") &&
        !out.includes(FAKE_RIDER) &&
        !out.includes(FAKE_PHONE) &&
        !out.includes(FAKE_EMAIL);
  console.log(`${ok ? "PASS" : "FAIL"}`, JSON.stringify(s), "→", JSON.stringify(out));
  if (!ok) fail += 1;
}
console.log(fail === 0 ? "ALL PASS" : `FAILED ${fail}`);
process.exit(fail === 0 ? 0 : 1);
