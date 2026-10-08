"use strict";

const crypto = require("crypto");

/**
 * HMAC-SHA256 short handle. Per-run salt prevents offline reversal of R-1xxxx.
 * Blank rider_id → "anon".
 */
function makeMasker(salt) {
  return function maskRiderId(riderId) {
    if (!riderId || !String(riderId).trim()) return "anon";
    const digest = crypto
      .createHmac("sha256", salt)
      .update(String(riderId).trim())
      .digest("hex");
    return `r_${digest.slice(0, 6)}`;
  };
}

function newRunSalt() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { makeMasker, newRunSalt };
