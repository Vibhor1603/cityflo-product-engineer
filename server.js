"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { parseCsv, normalizeRow } = require("./lib/csv");
const { makeMasker, newRunSalt } = require("./lib/mask");
const { classifyMessage, HARMS, redactPii } = require("./lib/classify");
const { applyOverrides, buildTriage } = require("./lib/rank");
const { request } = require("./lib/http");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const CSV_PATH = path.join(DATA_DIR, "feedback.csv");
const OVERRIDES_PATH = path.join(DATA_DIR, "overrides.json");
const BUNDLE_CSV_URL =
  "https://careers.cityflo.com/takehomes/product-engineer/data/feedback.csv";
const PORT = Number(process.env.PORT || 8787);

const RUN_SALT = process.env.MASK_SALT || newRunSalt();
const maskRiderId = makeMasker(RUN_SALT);

/** @type {Map<string, {harm:string, reason:string, at:string}>} */
let overrides = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadOverridesFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(OVERRIDES_PATH)) {
    overrides = new Map();
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
    overrides = new Map(Object.entries(raw || {}));
  } catch {
    overrides = new Map();
  }
}

function persistOverrides() {
  ensureDataDir();
  const obj = Object.fromEntries(overrides.entries());
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(obj, null, 2));
}

async function ensureCsv() {
  ensureDataDir();
  if (fs.existsSync(CSV_PATH) && fs.statSync(CSV_PATH).size > 0) return;
  const res = await request(BUNDLE_CSV_URL);
  if (!res.ok) throw new Error(`Failed to fetch starter CSV: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(CSV_PATH, text);
  console.log(`Fetched feedback.csv from Cityflo bundle → ${CSV_PATH}`);
}

function readSheetRows() {
  const text = fs.readFileSync(CSV_PATH, "utf8");
  return parseCsv(text).map((r, i) => normalizeRow(r, i));
}

function publicRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    channel: row.channel,
    route: row.route || "",
    handle: maskRiderId(row.rider_id),
    star_rating: row.star_rating || "",
    message: redactPii(row.message),
  };
}

async function triageRows(rawRows) {
  const classified = [];
  for (const raw of rawRows) {
    const pub = publicRow(raw);
    // classifyMessage also redacts before MOCK/model; display uses redacted text
    const classification = await classifyMessage(pub.message);
    const ov = overrides.get(raw.id) || null;
    classified.push(applyOverrides(pub, classification, ov));
  }
  return buildTriage(classified);
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Cityflo standup triage — Meera</title>
<style>
  :root {
    --bg: #f6f3ee;
    --ink: #1a1a1a;
    --muted: #5c5c5c;
    --line: #d9d2c5;
    --card: #fffdf8;
    --escalate: #7a1f1f;
    --escalate-bg: #f8e8e6;
    --money: #1f4a3a;
    --money-bg: #e6f2ec;
    --warn: #6b4a12;
    --warn-bg: #f5edd8;
    --token: #3a2f6b;
    --token-bg: #ece8f7;
    --reject: #5a1a3a;
    --reject-bg: #f8e6ef;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: "IBM Plex Sans", "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.45 var(--sans);
  }
  header.app {
    padding: 1.25rem 1.5rem 1rem;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, #fff 0%, var(--bg) 100%);
  }
  header.app h1 { margin: 0 0 .35rem; font-size: 1.35rem; letter-spacing: -0.02em; }
  header.app p { margin: 0; color: var(--muted); max-width: 52rem; }
  main { padding: 1rem 1.5rem 3rem; max-width: 960px; }
  .banner {
    border: 1px solid var(--line); border-radius: 6px; padding: 1rem 1.1rem;
    margin: 0 0 1rem; background: var(--card);
  }
  .banner.d1 { background: var(--escalate-bg); border-color: #e0b4ae; }
  .banner.nod1 { background: var(--warn-bg); border-color: #e0d2a8; }
  .banner h2 { margin: 0 0 .4rem; font-size: 1.05rem; }
  .banner .ask { margin: .5rem 0 0; font-size: .95rem; }
  section.block { margin: 1.25rem 0; }
  section.block > h3 {
    margin: 0 0 .55rem; font-size: .8rem; text-transform: uppercase;
    letter-spacing: .06em; color: var(--muted);
  }
  .row {
    background: var(--card); border: 1px solid var(--line); border-radius: 6px;
    padding: .85rem 1rem; margin: 0 0 .65rem;
  }
  .row.escalate { border-left: 4px solid var(--escalate); }
  .row.safety { border-left: 4px solid var(--warn); background: #fffaf0; }
  .row.money { border-left: 4px solid var(--money); background: var(--money-bg); }
  .row.token { border-left: 4px solid var(--token); background: var(--token-bg); }
  .row.reject { border-left: 4px solid var(--reject); background: var(--reject-bg); }
  .meta { display: flex; flex-wrap: wrap; gap: .4rem .75rem; font-size: .82rem; color: var(--muted); margin-bottom: .35rem; }
  .meta code { font-family: var(--mono); color: var(--ink); }
  .msg { white-space: pre-wrap; margin: .35rem 0; }
  .quote {
    font-family: var(--mono); font-size: .82rem; background: #f0ebe3;
    padding: .35rem .5rem; border-radius: 4px; margin: .4rem 0;
  }
  .trace {
    font-size: .8rem; color: var(--muted); border-top: 1px dashed var(--line);
    margin-top: .55rem; padding-top: .55rem;
  }
  .trace strong { color: var(--ink); font-weight: 600; }
  .badge {
    display: inline-block; font-size: .72rem; padding: .12rem .4rem;
    border-radius: 3px; background: #eee; color: #333; font-family: var(--mono);
  }
  .badge.mock { background: #333; color: #f5f5f5; }
  details.prompt { margin-top: .4rem; font-size: .8rem; }
  details.prompt pre {
    white-space: pre-wrap; background: #1e1e1e; color: #e8e8e8;
    padding: .6rem; border-radius: 4px; overflow: auto; max-height: 220px;
  }
  .override-form { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; margin-top: .5rem; }
  .override-form select, .override-form input, .override-form textarea, textarea#paste {
    font: inherit; padding: .35rem .45rem; border: 1px solid var(--line); border-radius: 4px;
    background: #fff;
  }
  .override-form textarea { min-width: 220px; flex: 1; min-height: 2.2rem; }
  button {
    font: inherit; cursor: pointer; border: 1px solid var(--ink);
    background: var(--ink); color: #fff; border-radius: 4px; padding: .35rem .7rem;
  }
  button.secondary { background: #fff; color: var(--ink); }
  .empty { color: var(--muted); font-size: .9rem; margin: 0 0 .5rem; }
  #paste { width: 100%; min-height: 7rem; font-family: var(--mono); font-size: .82rem; }
  .err { color: #7a1f1f; font-size: .85rem; }
  .src-note { font-size: .8rem; color: var(--muted); margin: 0 0 1rem; }
</style>
</head>
<body>
<header class="app">
  <h1>Standup triage for Meera</h1>
  <p>One walk-up for leadership. Classifier reads text only; ranking and escalation are deterministic rules. Rider ids are HMAC-masked per run.</p>
</header>
<main>
  <p class="src-note" id="modeNote">Loading…</p>
  <div id="header"></div>
  <div id="sections"></div>
  <section class="block">
    <h3>Paste new rows (live debrief)</h3>
    <p class="empty">Paste CSV with a header row (same columns as the sheet) or a JSON array of objects with at least <code>message</code>. Optional: id, route, channel, rider_id, star_rating, created_at.</p>
    <textarea id="paste" placeholder='id,route,message&#10;X-1,MUM-AND-LBS-01,driver was on phone the whole highway'></textarea>
    <p style="margin:.5rem 0"><button type="button" id="pasteBtn">Triage paste</button></p>
    <div id="pasteOut"></div>
  </section>
</main>
<script>
const HARMS = ${JSON.stringify(HARMS)};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}

function badgeSource(src) {
  const mock = String(src).startsWith("MOCK:");
  return '<span class="badge' + (mock ? ' mock' : '') + '">' + esc(src) + '</span>';
}

function rowCard(r, extraClass) {
  const ov = r.human_override;
  const stars = r.star_rating !== "" && r.star_rating != null ? r.star_rating + "★" : "—";
  const route = r.route || "(no route)";
  return '<article class="row ' + esc(extraClass || "") + '" data-id="' + esc(r.id) + '">' +
    '<div class="meta">' +
      '<code>' + esc(r.id) + '</code>' +
      '<span>' + esc(r.channel) + '</span>' +
      '<span>' + esc(route) + '</span>' +
      '<span>' + esc(stars) + '</span>' +
      '<span>handle <code>' + esc(r.handle) + '</code></span>' +
      '<span>harm <code>' + esc(r.harm) + '</code></span>' +
      (r.override_token_present ? '<span class="badge">override token present</span>' : '') +
    '</div>' +
    '<div class="msg">' + esc(r.message) + '</div>' +
    '<div class="quote">evidence: “' + esc(r.evidence_quote) + '”</div>' +
    '<div class="trace">' +
      '<div><strong>Rule:</strong> ' + esc(r.rule_fired || r.convention_b_reason || "") + '</div>' +
      '<div><strong>Classifier:</strong> ' + badgeSource(r.classifier_source) +
        (r.classifier_valid === false ? ' <span class="err">(invalid / rejected)</span>' : '') +
        (r.classifier_error ? ' <span class="err">' + esc(r.classifier_error) + '</span>' : '') +
      '</div>' +
      (ov ? '<div><strong>Human override:</strong> ' + esc(ov.from) + ' → ' + esc(ov.to) +
        ' — reason: ' + esc(ov.reason) + '</div>' : '<div><strong>Human override:</strong> none</div>') +
      (r.classifier_valid === false ? '<div class="err"><strong>Reject error:</strong> ' + esc(r.classifier_error || "unknown") + '</div>' : '') +
      (r.classifier_valid === false && r.classifier_raw != null ? '<div><strong>Raw model output:</strong> <code>' + esc(typeof r.classifier_raw === "string" ? r.classifier_raw : JSON.stringify(r.classifier_raw)) + '</code></div>' : '') +
      (r.convention_b_reason ? '<div><strong>Convention (b):</strong> ' + esc(r.convention_b_reason) + '</div>' : '') +
    '</div>' +
    '<details class="prompt"><summary>Exact prompt sent for this row</summary><pre>' + esc(r.prompt) + '</pre></details>' +
    '<form class="override-form" onsubmit="return submitOverride(event, \\'' + esc(r.id) + '\\')">' +
      '<label>Override harm <select name="harm">' +
        HARMS.map(h => '<option value="' + h + '"' + (h === r.harm ? ' selected' : '') + '>' + h + '</option>').join('') +
      '</select></label>' +
      '<textarea name="reason" required placeholder="Required reason"></textarea>' +
      '<button type="submit">Save override</button>' +
    '</form>' +
  '</article>';
}

function renderSection(title, rows, cls, emptyText) {
  let html = '<section class="block"><h3>' + esc(title) + '</h3>';
  if (!rows || !rows.length) html += '<p class="empty">' + esc(emptyText || "None in this batch.") + '</p>';
  else html += rows.map(r => rowCard(r, cls)).join("");
  html += '</section>';
  return html;
}

function renderHeader(h) {
  const cls = h.status === "d1_met" ? "d1" : "nod1";
  let html = '<div class="banner ' + cls + '"><h2>' + esc(h.title) + '</h2>';
  html += '<p>' + esc(h.summary) + '</p>';
  if (h.status === "d1_met") {
    html += '<p class="ask"><strong>Rows:</strong> ' + esc((h.row_ids || []).join(", ")) +
      ' · <strong>handle(s):</strong> ' + esc((h.handles || []).join(", ")) + '</p>';
  } else if (h.candidate) {
    html += '<p class="ask"><strong>Top safety candidate (human decide):</strong> ' +
      esc(h.candidate.id) + ' · ' + esc(h.candidate.handle) + ' · route ' + esc(h.candidate.route || "(none)") +
      '<br/>evidence: “' + esc(h.candidate.evidence_quote) + '”<br/>' +
      esc(h.candidate.rule_note) + '</p>';
  } else {
    html += '<p class="ask">No safety rows in this batch.</p>';
  }
  html += '</div>';
  return html;
}

async function loadBatch() {
  const res = await fetch("/api/batch");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "batch failed");
  document.getElementById("modeNote").textContent =
    "Classifier mode: " + data.classifier_mode +
    " · " + data.row_count + " rows · salt is per-run (handles change on restart)";
  document.getElementById("header").innerHTML = renderHeader(data.header);
  const s = data.sections;
  document.getElementById("sections").innerHTML =
    renderSection("Escalate (D1)", s.escalate_d1, "escalate", "No D1 matches.") +
    renderSection("Safety, same-day check (not escalated)", s.safety_same_day, "safety") +
    renderSection("Payments on-call today", s.payments, "money") +
    renderSection("Convention (b) would have suppressed", s.convention_b, "token",
      "No rows contain CF-PRIORITY-OVERRIDE.") +
    renderSection("Needs a human read (classifier output rejected)", s.needs_human, "reject",
      "No rejected classifier rows.") +
    renderSection("Deferred / other", s.deferred, "");
}

async function submitOverride(ev, id) {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const harm = fd.get("harm");
  const reason = String(fd.get("reason") || "").trim();
  if (!reason) { alert("Reason required"); return false; }
  const res = await fetch("/api/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, harm, reason }),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || "override failed"); return false; }
  await loadBatch();
  return false;
}

document.getElementById("pasteBtn").addEventListener("click", async () => {
  const text = document.getElementById("paste").value;
  const out = document.getElementById("pasteOut");
  out.innerHTML = "<p class='empty'>Triaging…</p>";
  const res = await fetch("/api/paste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    out.innerHTML = '<p class="err">' + esc(data.error || "paste failed") + '</p>';
    return;
  }
  out.innerHTML = renderHeader(data.header) +
    renderSection("Escalate (D1)", data.sections.escalate_d1, "escalate") +
    renderSection("Safety, same-day check (not escalated)", data.sections.safety_same_day, "safety") +
    renderSection("Payments on-call today", data.sections.payments, "money") +
    renderSection("Convention (b) would have suppressed", data.sections.convention_b, "token") +
    renderSection("Needs a human read (classifier output rejected)", data.sections.needs_human, "reject") +
    renderSection("Deferred / other", data.sections.deferred, "");
});

loadBatch().catch((e) => {
  document.getElementById("modeNote").innerHTML = '<span class="err">' + esc(e.message) + '</span>';
});
</script>
</body>
</html>`;

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(PAGE);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/batch") {
    try {
      await ensureCsv();
      const rows = readSheetRows();
      const triage = await triageRows(rows);
      const mode = process.env.OPENAI_API_KEY
        ? process.env.OPENAI_MODEL || "gpt-4o-mini"
        : "MOCK: keyword rules, not a model";
      sendJson(res, 200, {
        classifier_mode: mode,
        row_count: rows.length,
        header: triage.header,
        sections: triage.sections,
      });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/override") {
    try {
      const body = await readBody(req);
      const id = String(body.id || "").trim();
      const harm = String(body.harm || "").trim().toLowerCase();
      const reason = String(body.reason || "").trim();
      if (!id) return sendJson(res, 400, { error: "id required" });
      if (!HARMS.includes(harm)) return sendJson(res, 400, { error: "invalid harm" });
      if (!reason) return sendJson(res, 400, { error: "reason required" });
      overrides.set(id, { harm, reason, at: new Date().toISOString() });
      persistOverrides();
      sendJson(res, 200, { ok: true, id, override: overrides.get(id) });
    } catch (e) {
      sendJson(res, 400, { error: String(e.message || e) });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/paste") {
    try {
      const body = await readBody(req);
      const text = String(body.text || "").trim();
      if (!text) return sendJson(res, 400, { error: "text required" });
      let rawRows;
      if (text.startsWith("[")) {
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error("JSON must be an array");
        rawRows = arr.map((r, i) => normalizeRow(r, i));
      } else {
        rawRows = parseCsv(text).map((r, i) => normalizeRow(r, i));
      }
      if (!rawRows.length) return sendJson(res, 400, { error: "no rows parsed" });
      for (const r of rawRows) {
        if (!r.message) return sendJson(res, 400, { error: `row ${r.id} missing message` });
      }
      const triage = await triageRows(rawRows);
      sendJson(res, 200, {
        classifier_mode: process.env.OPENAI_API_KEY
          ? process.env.OPENAI_MODEL || "gpt-4o-mini"
          : "MOCK: keyword rules, not a model",
        row_count: rawRows.length,
        header: triage.header,
        sections: triage.sections,
      });
    } catch (e) {
      sendJson(res, 400, { error: String(e.message || e) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      has_csv: fs.existsSync(CSV_PATH),
      override_count: overrides.size,
      classifier: process.env.OPENAI_API_KEY ? "model" : "MOCK: keyword rules, not a model",
    });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

async function main() {
  loadOverridesFromDisk();
  await ensureCsv();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      sendJson(res, 500, { error: String(e.message || e) });
    });
  });
  server.listen(PORT, () => {
    console.log(`Meera triage UI → http://127.0.0.1:${PORT}`);
    console.log(
      `Classifier: ${
        process.env.OPENAI_API_KEY
          ? process.env.OPENAI_MODEL || "gpt-4o-mini"
          : "MOCK: keyword rules, not a model"
      }`
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
