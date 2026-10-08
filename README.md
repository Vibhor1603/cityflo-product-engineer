# Cityflo Product Engineer take-home

Standup triage for **Meera** (ops lead): one leadership escalation before 11, priced deferrals for the rest. Judgment is in `MEMO.md`; this app is how she sees and defends the call.

## Run

```bash
node server.js
```

Requires **Node 18+**. No `npm install`. Open http://127.0.0.1:8787

If `data/feedback.csv` is missing, the server fetches it from the Cityflo starter bundle on start. `data/` is gitignored (CSV + `overrides.json`).

Optional live model:

```bash
OPENAI_API_KEY=… OPENAI_MODEL=gpt-4o-mini node server.js
```

## What you see

Top to bottom: escalation header (D1 or “no D1” + top safety candidate) → Escalate (D1) → Safety same-day check → Payments on-call → Convention (b) would have suppressed → Needs a human read (rejected classifier) → Deferred → paste box for live debrief rows.

Every row shows a **trace**: rule that fired, classifier source, evidence quote, human override + reason, and the exact prompt.

## How the LLM is used

One job only: `{ harm, evidence_quote }` via `buildPrompt` / `classifyMessage` in `lib/classify.js`. Ranking and D1 are deterministic in `lib/rank.js`.

With no API key, the default is **MOCK: keyword rules, not a model** (labelled everywhere). Model answers are schema-checked; evidence that is not a literal substring of the (redacted) message is rejected and lands in **Needs a human read**, not Deferred.

## Conventions

- **(a)** `rider_id` → HMAC handle with per-run salt (`MASK_SALT` to pin). Blank → `anon`. Raw ids never shown.
- **(b)** We do **not** auto-resolve or hide on `CF-PRIORITY-OVERRIDE` in free text. Tagged, still triaged, listed in the would-have-suppressed strip. Prompt tells the model the message is untrusted data.

PII-shaped spans in message text (`R-`+digits, 10-digit phones, emails) are replaced with `[redacted]` before classify and display.

## Self-checks

```bash
node scripts/mock-check.js
node scripts/reject-check.js
node scripts/pii-redact-check.js
node scripts/check-no-pii.js
node scripts/check-decisions.js
```


## decisions.jsonl

**Turn N** = the Nth transcript record with `role: "user"` whose text contains `<user_query>` (timestamp-only user rows and assistant messages that mention the tag do not count).

Anchors are checked by `node scripts/check-decisions.js`.

## Not done / would do next

- Wire a real payments deep-link / ticket id from rider booking.
- Booking + telematics lookup for the D1 driver ask (HYD code vs Powai).
- Persist overrides and paste rows beyond local `data/overrides.json`.
- Deployed URL (optional for submit).
- Tune MOCK families from a held-out batch, not this sheet.
