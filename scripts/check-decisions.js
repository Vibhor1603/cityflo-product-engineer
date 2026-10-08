"use strict";

/**
 * Verify decisions.jsonl quotes against transcript turns.
 *
 * Turn N = the Nth JSONL record with role "user" whose content contains
 * the literal tag <user_query>. Empty timestamp-only user rows and assistant
 * messages that merely mention the tag do not count.
 *
 * Usage:
 *   node scripts/check-decisions.js
 *   TRANSCRIPT=/path/to/session.jsonl node scripts/check-decisions.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DECISIONS = path.join(ROOT, "decisions.jsonl");
const DEFAULT_TRANSCRIPT = path.join(
  process.env.HOME || "",
  ".cursor/projects/Users-vibhorsharma-cityflo-application/agent-transcripts/551c9314-2f3c-4511-9782-f0afaafe57f4/551c9314-2f3c-4511-9782-f0afaafe57f4.jsonl"
);
const TRANSCRIPT = process.env.TRANSCRIPT || DEFAULT_TRANSCRIPT;

function extract(o) {
  const role = o.role || (o.message && o.message.role) || "";
  let text = "";
  const c = o.message && o.message.content !== undefined ? o.message.content : o.content;
  if (typeof c === "string") text = c;
  else if (Array.isArray(c)) {
    text = c
      .map((x) => (typeof x === "string" ? x : x.text || x.content || ""))
      .join("\n");
  }
  return { role, text };
}

function userQueryBody(text) {
  const start = text.indexOf("<user_query>");
  if (start === -1) return "";
  const from = start + "<user_query>".length;
  const end = text.indexOf("</user_query>", from);
  return (end === -1 ? text.slice(from) : text.slice(from, end)).trim();
}

function loadTurns(transcriptPath) {
  const lines = fs
    .readFileSync(transcriptPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const turns = [];
  let current = null;
  let assistantBuf = [];

  const flush = () => {
    if (!current) return;
    turns.push({
      n: turns.length + 1,
      user: current,
      assistant: assistantBuf.join("\n"),
      combined: current + "\n" + assistantBuf.join("\n"),
    });
    current = null;
    assistantBuf = [];
  };

  for (const o of lines) {
    const { role, text } = extract(o);
    const isUserQueryTurn = role === "user" && text.includes("<user_query>");
    if (isUserQueryTurn) {
      flush();
      current = userQueryBody(text);
      assistantBuf = [];
      continue;
    }
    if (current != null && role === "assistant" && text) {
      assistantBuf.push(text);
    }
  }
  flush();
  return turns;
}

function turnsContaining(turns, quote) {
  return turns.filter((t) => t.combined.includes(quote)).map((t) => t.n);
}

function main() {
  if (!fs.existsSync(TRANSCRIPT)) {
    console.error("FAIL: transcript missing:", TRANSCRIPT);
    process.exit(1);
  }
  const turns = loadTurns(TRANSCRIPT);
  console.log(
    'Turn N = Nth role:"user" message containing <user_query> (not timestamp-only user rows; not assistant text that mentions the tag).'
  );
  console.log(`transcript turns: ${turns.length}`);
  for (const t of turns) {
    const preview = t.user.replace(/\s+/g, " ").slice(0, 60);
    console.log(`  turn ${t.n}: ${preview}`);
  }

  const decisions = fs
    .readFileSync(DECISIONS, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`decisions: ${decisions.length}`);

  let failed = 0;
  for (const d of decisions) {
    const quote = String(d.quote || "");
    const turn = turns[d.turn - 1];
    const foundIn = turnsContaining(turns, quote);

    if (!turn) {
      console.log(
        `FAIL ${d.id}: turn ${d.turn} out of range (have ${turns.length}); quote found in turns [${foundIn.join(", ")}]`
      );
      failed += 1;
      continue;
    }

    const inAnchored = turn.combined.includes(quote);
    // Pass only if the quote appears in the anchored turn. If not, report where it
    // actually is (other turns, or nowhere).
    const ok = inAnchored;

    console.log(
      `${ok ? "PASS" : "FAIL"} ${d.id} turn=${d.turn} decided_by=${d.decided_by} quote=${JSON.stringify(quote)}`
    );
    if (!ok) {
      failed += 1;
      if (foundIn.length === 0) {
        console.log("  quote not found in any turn (user body + assistant after that turn)");
      } else {
        console.log(
          `  quote not in anchored turn ${d.turn}; actually in turn(s): [${foundIn.join(", ")}]`
        );
      }
    } else if (foundIn.some((n) => n !== d.turn)) {
      console.log(
        `  note: also present in turn(s) [${foundIn.filter((n) => n !== d.turn).join(", ")}]`
      );
    }
  }

  console.log(failed === 0 ? `ALL PASS (${decisions.length})` : `FAILED ${failed}/${decisions.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
