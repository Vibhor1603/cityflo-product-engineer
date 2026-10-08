"use strict";

const { hasOverrideToken } = require("./classify");

/**
 * Deterministic placement. Classifier only supplies harm + evidence.
 * No hard-coded message ids anywhere.
 *
 * Rejected classifier output (valid=false, no human override) → needs_human.
 * D1 escalate: safety + non-blank route + same handle has ≥2 safety rows with a route.
 * Other safety → same-day check.
 * Money → payments on-call.
 * Token rows → convention (b) strip (in addition to their harm bucket).
 */

function applyOverrides(row, classification, override) {
  const base = {
    ...row,
    harm: classification.harm,
    evidence_quote: classification.evidence_quote || "",
    classifier_source: classification.source,
    classifier_valid: classification.valid !== false,
    classifier_error: classification.error || null,
    classifier_raw:
      classification.raw !== undefined && classification.raw !== null
        ? classification.raw
        : null,
    prompt: classification.prompt,
    override_token_present: hasOverrideToken(row.message),
    human_override: null,
  };
  if (override && override.harm) {
    base.human_override = {
      from: classification.harm,
      to: override.harm,
      reason: override.reason || "",
      at: override.at || null,
    };
    base.harm = override.harm;
  }
  return base;
}

function sectionFor(row, safetyHandleCounts) {
  if (row.classifier_valid === false && !row.human_override) {
    return {
      key: "needs_human",
      rule:
        "Needs a human read: classifier output rejected (schema or evidence quote failed validation)",
    };
  }
  const hasRoute = Boolean(row.route && row.route.trim());
  if (row.harm === "safety" && hasRoute && (safetyHandleCounts.get(row.handle) || 0) >= 2) {
    return {
      key: "escalate_d1",
      rule: "D1: safety + tied to a route + repeat from the same handle (≥2 safety+route rows)",
    };
  }
  if (row.harm === "safety") {
    return {
      key: "safety_same_day",
      rule: "Safety, same-day check (not escalated): safety row that does not meet D1",
    };
  }
  if (row.harm === "money") {
    return {
      key: "payments",
      rule: "Payments on-call today: harm = money (reversible; not leadership walk-up)",
    };
  }
  if (row.harm === "service") {
    return {
      key: "deferred",
      rule: "Deferred: service issue — sit until tomorrow per memo cuts",
    };
  }
  if (row.harm === "product") {
    return {
      key: "deferred",
      rule: "Deferred: product/UX — sit until tomorrow per memo cuts",
    };
  }
  if (row.harm === "praise") {
    return {
      key: "deferred",
      rule: "Deferred: praise / no action needed for standup",
    };
  }
  return {
    key: "deferred",
    rule: "Deferred: unclear or unbucketed",
  };
}

function countSafetyWithRouteByHandle(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (r.classifier_valid === false && !r.human_override) continue;
    if (r.harm === "safety" && r.route && r.route.trim() && r.handle !== "anon") {
      counts.set(r.handle, (counts.get(r.handle) || 0) + 1);
    }
  }
  return counts;
}

function sortByCreatedAtAsc(a, b) {
  return String(a.created_at).localeCompare(String(b.created_at));
}

function sortByCreatedAtDesc(a, b) {
  return String(b.created_at).localeCompare(String(a.created_at));
}

function buildTriage(classifiedRows) {
  const safetyCounts = countSafetyWithRouteByHandle(classifiedRows);
  const placed = classifiedRows.map((r) => {
    const sec = sectionFor(r, safetyCounts);
    return {
      ...r,
      section: sec.key,
      rule_fired: sec.rule,
      trace: {
        rule_fired: sec.rule,
        classifier_source: r.classifier_source,
        evidence_quote: r.evidence_quote,
        human_override: r.human_override,
        override_token_present: r.override_token_present,
        classifier_valid: r.classifier_valid,
        classifier_error: r.classifier_error,
        classifier_raw: r.classifier_raw,
      },
    };
  });

  const escalate = placed.filter((r) => r.section === "escalate_d1").sort(sortByCreatedAtAsc);
  const safetySameDay = placed
    .filter((r) => r.section === "safety_same_day")
    .sort(sortByCreatedAtDesc);
  const payments = placed.filter((r) => r.section === "payments").sort(sortByCreatedAtAsc);
  const conventionB = placed
    .filter((r) => r.override_token_present)
    .sort(sortByCreatedAtAsc)
    .map((r) => ({
      ...r,
      convention_b_reason:
        "Message text contains CF-PRIORITY-OVERRIDE. Convention (b) as written would auto-resolve and hide this row. We do not: tagged only, still triaged on content.",
    }));
  const needsHuman = placed.filter((r) => r.section === "needs_human").sort(sortByCreatedAtDesc);
  const deferred = placed.filter((r) => r.section === "deferred").sort(sortByCreatedAtDesc);

  let header;
  if (escalate.length > 0) {
    const handles = [...new Set(escalate.map((r) => r.handle))];
    header = {
      status: "d1_met",
      title: "Escalate (D1)",
      summary:
        "Safety + route + same-handle repeat. Ask leadership: identify actual bus/driver from this rider's booking (do not trust route code alone if the place named disagrees), and take that driver off his next scheduled run pending review.",
      handles,
      row_ids: escalate.map((r) => r.id),
      candidate: null,
    };
  } else {
    const topSafety =
      [...placed]
        .filter((r) => r.harm === "safety" && r.section !== "needs_human")
        .sort(sortByCreatedAtDesc)[0] || null;
    header = {
      status: "d1_not_met",
      title: "No row met D1",
      summary:
        "Nothing in this batch is safety + tied to a route + repeat from the same handle. Top safety row (if any) is shown as a candidate for a human to decide — not an auto-escalation.",
      handles: [],
      row_ids: [],
      candidate: topSafety
        ? {
            id: topSafety.id,
            handle: topSafety.handle,
            route: topSafety.route,
            evidence_quote: topSafety.evidence_quote,
            rule_note:
              "Candidate only: safety present but D1 repeat/route bar not met (or judge manually).",
          }
        : null,
    };
  }

  return {
    header,
    sections: {
      escalate_d1: escalate,
      safety_same_day: safetySameDay,
      payments: payments,
      convention_b: conventionB,
      needs_human: needsHuman,
      deferred,
    },
    all: placed,
  };
}

module.exports = {
  applyOverrides,
  buildTriage,
  countSafetyWithRouteByHandle,
  sectionFor,
};
