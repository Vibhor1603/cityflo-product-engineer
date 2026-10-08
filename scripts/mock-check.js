"use strict";

/**
 * Self-check: invented messages (NOT from feedback.csv) → expected harm.
 * Run: node scripts/mock-check.js
 */
const { mockClassify } = require("../lib/classify");

const CASES = [
  {
    msg: "driver was on a video call the whole way on the expressway, 5 stars though",
    expect: "safety",
  },
  {
    msg: "he was looking at his phone on the highway stretch near the toll",
    expect: "safety",
  },
  {
    msg: "bahut tez chalaya, darr lag gaya at the signal",
    expect: "safety",
  },
  {
    msg: "driver seemed in nashe, weaving between lanes",
    expect: "safety",
  },
  {
    msg: "overspeeding and hard braking every few minutes",
    expect: "safety",
  },
  {
    msg: "jumped the signal near the metro and overtook from the wrong side",
    expect: "safety",
  },
  {
    msg: "conductor tried to harass me when I asked about the stop",
    expect: "safety",
  },
  {
    msg: "UPI success but monthly pass still inactive after renewal",
    expect: "money",
  },
  {
    msg: "bus was late and AC was off again this evening",
    expect: "service",
  },
  {
    msg: "love the service, keep it up, no complaints",
    expect: "praise",
  },
];

let failed = 0;
for (const c of CASES) {
  const out = mockClassify(c.msg);
  const ok = out.harm === c.expect && out.valid === true && c.msg.includes(out.evidence_quote);
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} expect=${c.expect} got=${out.harm} quote=${JSON.stringify(out.evidence_quote)}`
  );
  if (!ok) console.log("  msg:", c.msg);
}
console.log(failed === 0 ? `ALL PASS (${CASES.length})` : `FAILED ${failed}/${CASES.length}`);
process.exit(failed === 0 ? 0 : 1);
