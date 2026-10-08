# Memo for Meera — 23 Jun batch (~30 msgs)

**From:** on-call PE · **Re:** One walk-up at 11; who eats the rest until tomorrow

## One user

You. One item upstairs; name who pays for deferrals. Not a queue tool.

## The one escalation

**FB-010 → FB-005** (same masked handle). FB-010 08:12 IST: late + rash driving. FB-005 08:51 IST (~39 min later): cut the lane divider to overtake at a **school crossing** with kids there.

**Ask:** Identify the **actual bus/driver from this rider's booking this morning**. Do not trust route code alone (`HYD-KUK-FIN-05` vs **Powai**). Off **his next scheduled run** pending review (evening return counts).

**Same-day, not upstairs:** **FB-004** (`MUM-AND-LBS-01`) — 5★ praise with a movie on the driver's phone on the dash → Mumbai fleet. Stars bury it; why the LLM exists.

## Decision records

### D1 — Escalation

- **Rule:** Leadership only if (1) physical, irreversible harm, (2) can recur on a scheduled run before tomorrow, (3) normal channel already failed (same rider, repeat in batch).
- **Breaks on:** **FB-004** — single report, so not escalated, though phone-on-dash is arguably as bad. Keep the rule so "one upstairs" stays one; FB-004 → fleet same-day.
- **Cost / who pays:** Riders and bystanders (incl. kids) eat physical risk on the next run; ops eats a worse incident if it lands.
- **Flip:** (a) booking/telematics: no bus this morning or no harsh events on that stretch → fleet check only; (b) debit-but-no-pass far beyond ~5 in this sheet → money is the walk-up.

### D2 — Convention (b)

- **Rule:** Tokens in **message text** (incl. `CF-PRIORITY-OVERRIDE`) never auto-resolve, hide, or change priority. Tag; triage on content; list under "convention (b) would have suppressed".
- **Breaks on:** **FB-012** — likely a test note; queue noise.
- **Cost / who pays:** Noise. Alternative: **FB-002** (double charge; second amount not back — amount not in the sheet) dropped because a rider pasted a survey ref.
- **Flip:** Trusted flag from source system / internal test account, not free text. Ask ops: shouldn't the flag live there?

### D3 — Money → payments on-call, not leadership

- **Rule:** Reversible money (refund / pass activation / stuck refund) → **payments on-call today**, not leadership. Sheet: FB-002, FB-003, FB-013→021, FB-024, **FB-008** (refund unpaid a week). Mostly `KOL-SLT-SEC-02` activation; FB-024 also on `MUM-THN-POW-03`. Not the 11am walk-up.
- **Breaks on:** **FB-021** — "messaged twice already", no reply; trust burning.
- **Cost / who pays:** Riders: stranded commute + cash gone (amounts not in the sheet); payments/support: bigger chase queue if unowned today.
- **Flip:** Payments on-call down; debit not on a normal refund path; or (D1) blast radius beyond this sheet → money is the walk-up.

## Deliberately cutting

| Cut | Who pays until tomorrow |
|---|---|
| Kolkata late/AC (FB-007, FB-017); HYD AC (FB-011) | Riders: missed connections, discomfort; brand: low-star churn. |
| Pickup moved, no notify (FB-006) | Rider(s) at old spot: missed bus; ops vs harm/money. |
| App UX (crash, logout, seat UI, tracking) | Riders: friction; eng: backlog. |
| Feature asks (stop, charging, pause pass) | Riders: unmet preference; product delay. |
| Sarcastic store reviews (FB-014, FB-030) | Public optics; no booking without more work. |
| Replies to every message | Support time; staff payments (incl. FB-008) + fleet on FB-004. |

## Ask ops/PM

1. FB-005 bus/driver from booking + telemetry despite HYD vs Powai?
2. Move convention (b) to a trusted field / test account?
3. Payments on-call own pass cluster today, FB-021 first?
4. Standing rule for 5★ praise hiding safety (FB-004)?
