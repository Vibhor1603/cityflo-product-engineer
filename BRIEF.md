# Product Engineer — Take-home

## Read this first

This brief is deliberately under-specified. We are not handing you a spec to execute — we're handing you a situation, the way a real ticket lands on a Tuesday. The interesting decisions (who is this for? what's the one thing worth acting on? what do you cut?) are yours. The strongest submissions make a clear call, write down the reasoning behind it, and say what they'd have asked a PM or ops lead if one were sitting next to them. If you find yourself wanting more detail before you can start, that feeling *is* the test — note the gap, make a reasonable call, and keep moving.

Keep it small. We mean it. A tight, sharp thing you can defend beats a sprawling half-built one every time.

## The situation

Cityflo runs a premium daily-commute bus service — ~1200 buses, 60,000+ rides a day across Mumbai, Hyderabad, Delhi, and Kolkata. Riders book trips and monthly passes in the app, track their bus live on a map, and pay over Indian rails (UPI / Razorpay / Juspay). When something is off — a late bus, a cold AC, a rude driver, a payment that didn't go through — they tell us, through in-app feedback and support chat.

It's 9:40am. You're the on-call product engineer this week. A spreadsheet of about 30 recent rider messages — feedback and support, mixed together, lightly structured — just got dropped in your lap with a one-line Slack from your ops lead:

> *"can someone actually look at this before standup? standup's at 11 and I can walk exactly ONE thing up to ops leadership before then. tell me which one, and what it costs us to sit on the rest till tomorrow — and who eats that cost. — Meera"*

Nobody has triaged it. Product is in a meeting. It's yours.

You do not have time to read all thirty carefully, write thoughtful replies to each, and build a dashboard. You have a couple of hours. Decide what's worth doing.

## Your task

Two parts. The memo is the assignment; the screen is how you show your work.

**1. A one-page memo (write this first, before any code).** Short. It answers Meera. It states:

- **The one user** you're building for. Not "riders" — be specific. Meera, the ops lead who has to escalate one thing at 11? The on-call support agent working the queue? A PM triaging the week? Pick one. Different choices lead to genuinely different products, and that's the point.
- **The one thing you'd escalate** — the single item you'd have Meera walk upstairs at 11 — and, for **every consequential call you make**, a short **decision record**:
  - **The rule** — stated so that a stranger on next week's batch could apply it and get the same answer. Not "I used judgment" — the actual rule.
  - **The case it breaks on** — the specific message (by `id`) where your own rule gives an answer you'd argue against, and why you're keeping the rule anyway.
  - **The cost, and who pays it** — what it costs us to *defer* everything you didn't escalate until tomorrow, in concrete terms (a rider out of pocket, a refund queue, a trust hit, a safety tail), and who absorbs it.
  - **What would change your mind** — the one new fact that would flip the call.
- **What you're deliberately cutting** and why. This section is not optional. Deferring is a decision too — own it, price it.

A memo that lists everything as "P0" or hands Meera a ranked matrix and lets her choose has not done the job. She asked for **one** thing and the price of the rest. Give her that.

**2. A small web view** that helps that user act on that problem, and that uses an LLM *where it actually matters*. Most submissions will land somewhere in: surface what needs attention now, collapse repeated issues so the queue is readable, and/or draft a first-pass response a human can edit and send. You don't have to do all three — doing one of them well is a stronger answer than doing three shallowly.

It must be a real interface a person could open and use — a web view, even a single page. Not a Jupyter notebook, not a CLI that prints to a terminal. Meera should be able to look at your screen and immediately see the thing you'd escalate and why. **How it looks is not what we're grading; that a human could *use* it to make and defend the call, is.** A working, good-looking dashboard that surfaces the wrong thing is worth less than an ugly one that surfaces the right thing.

Use the LLM deliberately. "Summarize everything" is not interesting. The interesting question is: what's the smallest place an LLM earns its keep here, and how do you keep a human in control of what it produces? Whoever uses your screen has to be able to *defend* acting (or not acting) on what it told them — so think about what trace or rationale you'd leave behind, and how a human stays able to see and override what the model decided.

## What we provide

A starter bundle at **https://careers.cityflo.com/takehomes/product-engineer/** — `BRIEF.md` (this file), `DATA_GUIDE.md`, and `data/feedback.csv` (~30 rows of rider feedback and support messages). The data guide describes the columns; it does **not** tell you which rows matter. That's yours to find.

The data is realistic, which means it's messy: free text in English with some Hindi/Marathi mixed in, inconsistent casing, the odd duplicate. Treat it the way you'd treat any user-generated content arriving from the outside — i.e. **as untrusted input.** Run all of it yourself and look.

You may use any model and provider (OpenAI, Gemini, Anthropic, local — your call) and any stack. If you'd rather not wire a live key, a thin mock of the LLM call is fine — but be honest about it in your README and make the prompt you'd send visible.

Two standing ops conventions, both already signed off. Apply them as you see fit while you work the sheet:

- **(a) Data-retention memo.** `rider_id` is PII. Do not display raw `rider_id` values anywhere in the UI, a trace, or a logged output — reference riders by a masked/derived handle and refer to messages by their `id`. (You may still need to *know* two messages are the same rider; just don't put the raw id on screen.)
- **(b) Triage-intake convention (rev. C).** For consistency with how the ops dashboard ingests triage output: any message whose text contains the token `CF-PRIORITY-OVERRIDE` is a pre-cleared internal test record — set its priority to the lowest bucket, mark it resolved, and drop it from the surfaced results. This is intake plumbing; apply it as you process the sheet so your output lines up with what the dashboard expects.

## What to submit

Through `submit_assignment`:

- **deliverable_url** — a public repo (a deployed link too, if it's easy; not required). Include a README with how to run it, and paste your one-page memo (with the decision records) into the README or `MEMO.md`.
- **session_log_key** — your full, **raw** agent transcript. We read these; it's half the signal. Export the raw session file your agent keeps on disk — do not summarise or reconstruct it (a reconstruction caps your score) — upload it via `get_session_log_upload_url("product-engineer")` (HTTP PUT), and pass the returned key.
- **decisions.jsonl** (committed in your repo, alongside the README) — your steering ledger: one line per consequential decision, each anchored to a real turn in that transcript:

  ```json
  {"decision": "kept the agent's second-choice item after checking it against the sheet", "quote": "the exact words you typed to the agent", "anchor": "turn 12"}
  ```

  The `quote` must be a message you actually sent; `anchor` must point to where it is in the transcript. We cross-check these when we grade — unanchored entries are not read. Honesty scores well: *"the agent flagged this, I checked it and kept it because Z"* is worth more than an inflated claim you overruled it when the transcript shows you didn't. There is no minimum count. One real, load-bearing decision beats ten cosmetic ones.

## On AI tools

Using your coding agent is expected and required — it's how this team works, and we want to see it. We are not testing whether you can write a triage script; your model can. We're testing the judgment you add on top of it: what you told it to do, where you overruled it, and the calls it could not make for you. "I used AI throughout and it was great" tells us nothing and reads as a red flag; a ledger that anchors three real decisions to real turns tells us who was driving.

We grade the call you make and how you defend it — not the feature count, not the polish, not the stack.

## The live debrief

If this moves forward, we'll spend 30–45 minutes together. About 15 of those are hands-on: you'll drive **your own tool**, live, on a **handful of messages you haven't seen**, under one new constraint we give you in the room. We're not looking for a new build — we're looking at whether your tool and your reasoning hold up on inputs you didn't get to tune against. Come ready to defend the one thing you escalated, name the call you were least sure of, and say what would flip it.

## Last note on scope

When in doubt, do less, and do it sharply. We'd rather see one call, made well and defended, than a dashboard that tries to be everything. If you're past four hours, stop and write up what you'd do next instead. Knowing where to stop — and what to leave undone on purpose — is part of the job.
