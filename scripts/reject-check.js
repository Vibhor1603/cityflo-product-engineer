"use strict";

/**
 * Prove rejected classifier output stays visible (needs_human), not Deferred.
 * Run: node scripts/reject-check.js
 */
const { validateClassification } = require("../lib/classify");
const { applyOverrides, buildTriage, sectionFor } = require("../lib/rank");

const message = "driver was on a video call the whole way, I was scared";
const bad = {
  harm: "safety",
  evidence_quote: "driver was distracted on a call", // paraphrase — not a substring
};

const v = validateClassification(message, bad);
console.log("validateClassification.ok =", v.ok, "error =", v.error);
if (v.ok) {
  console.error("FAIL: expected validation to reject paraphrased quote");
  process.exit(1);
}

const row = applyOverrides(
  {
    id: "TEST-REJ-1",
    created_at: "2026-06-23T09:00:00+05:30",
    channel: "support_chat",
    route: "MUM-AND-LBS-01",
    handle: "r_test01",
    star_rating: "",
    message,
  },
  {
    harm: "safety",
    evidence_quote: "",
    source: "gpt-test",
    prompt: "(test)",
    valid: false,
    error: v.error,
    raw: bad,
  },
  null
);

const sec = sectionFor(row, new Map());
console.log("sectionFor.key =", sec.key);
console.log("sectionFor.rule =", sec.rule);

const triage = buildTriage([row]);
const inNeeds = triage.sections.needs_human.some((r) => r.id === "TEST-REJ-1");
const inDeferred = triage.sections.deferred.some((r) => r.id === "TEST-REJ-1");
console.log("in needs_human =", inNeeds);
console.log("in deferred =", inDeferred);
console.log("classifier_error =", triage.sections.needs_human[0]?.classifier_error);
console.log("classifier_raw =", JSON.stringify(triage.sections.needs_human[0]?.classifier_raw));

const ok = sec.key === "needs_human" && inNeeds && !inDeferred;
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
