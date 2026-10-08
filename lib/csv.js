"use strict";

/**
 * Minimal RFC4180-ish CSV parser (no npm).
 * Handles quoted fields, commas, and newlines inside quotes.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== "")).map((r) => {
    const obj = {};
    for (let h = 0; h < headers.length; h++) {
      obj[headers[h]] = r[h] != null ? String(r[h]) : "";
    }
    return obj;
  });
}

function normalizeRow(raw, index) {
  const id = (raw.id || raw.Id || `PASTE-${index + 1}`).trim();
  return {
    id,
    created_at: (raw.created_at || raw.createdAt || "").trim(),
    channel: (raw.channel || "").trim(),
    route: (raw.route || "").trim(),
    rider_id: (raw.rider_id || raw.riderId || "").trim(),
    star_rating: (raw.star_rating || raw.starRating || raw.stars || "").trim(),
    message: (raw.message || raw.text || "").trim(),
  };
}

module.exports = { parseCsv, normalizeRow };
