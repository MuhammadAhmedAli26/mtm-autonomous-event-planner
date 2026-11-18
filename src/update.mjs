/**
 * Update Gate
 * Transactionally applies incremental messages, validates invariants,
 * catches conflicts, and protects plan validity.
 * Strictly adheres to Part 9 of the official build prompt.
 */

import { Ledger, computeSlotKey } from "./ledger.mjs";
import { planEvent } from "./planner.mjs";
import { runSixChecks } from "./checks.mjs";
import { trace } from "./trace.mjs";
import crypto from "crypto";

export function computeTextHash(text) {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

export function applyMessageUpdate(ledger, currentPlan, newMsg, existingHashes = new Set()) {
  const textHash = computeTextHash(newMsg.rawText || "");
  if (existingHashes.has(textHash)) {
    newMsg.finalStatus = "DUPLICATE";
    newMsg.rejectionReason = "Identical message content already processed.";
    trace.logDecision(`Duplicate message ignored: "${newMsg.rawText.slice(0, 50)}..."`);
    return {
      accepted: false,
      reason: newMsg.rejectionReason,
      plan: currentPlan,
      affectedAreas: [],
    };
  }

  // Irrelevant or unapproved requests are marked cleanly
  if (newMsg.status === "irrelevant") {
    newMsg.finalStatus = "IGNORED";
    trace.logDecision(`Ignored irrelevant chatter: "${newMsg.rawText.slice(0, 50)}..."`);
    return {
      accepted: true,
      plan: currentPlan,
      affectedAreas: [],
    };
  }
  if (newMsg.status === "request") {
    newMsg.finalStatus = "NOT APPROVED";
    trace.logDecision(`Not approved request logged: "${newMsg.rawText.slice(0, 50)}..."`);
    return {
      accepted: true,
      plan: currentPlan,
      affectedAreas: [],
    };
  }

  // Transactional application on a copy of the ledger
  const trialLedger = Ledger.clone(ledger);
  let keptClaims = [];
  let rejectionReason = null;

  for (const claim of newMsg.claims || []) {
    // Standing check
    const standing = trialLedger.checkStanding(newMsg, claim);
    if (!standing.allowed) {
      rejectionReason = standing.reason;
      trace.logDecision(`REJECTED claim: ${standing.reason}`);
      break;
    }

    // Specific Hard Constraint Checks (e.g. Under-covering food commit)
    if (claim.k === "commit" && claim.what === "food_qty") {
      const currentHeadcount = currentPlan.meta.headcount;
      if (claim.qty < currentHeadcount) {
        rejectionReason = `food quantity ${claim.qty} is below the people who must eat (${currentPlan.meta.students} students + ${currentPlan.meta.staff} staff + ${currentPlan.meta.judges} judges = ${currentHeadcount})`;
        trace.logDecision(`REJECTED: ${rejectionReason}`);
        break;
      }
    }

    // Trial application
    const trialClaims = trialLedger.getActiveClaims();
    // Add trial claim
    trialClaims.push(claim);
    const candidatePlan = planEvent(trialClaims);
    const candidateChecks = runSixChecks(candidatePlan, trialLedger);

    if (candidateChecks.allPassed) {
      keptClaims.push(claim);
    } else {
      rejectionReason = candidatePlan.reason || "Invariant checks failed";
      trace.logDecision(`REJECTED claim: ${rejectionReason}`);
      break;
    }
  }

  if (rejectionReason || keptClaims.length === 0) {
    newMsg.finalStatus = "REJECTED";
    newMsg.rejectionReason = rejectionReason || "Failed validity checks";
    ledger.messages.push(newMsg);
    return {
      accepted: false,
      reason: newMsg.rejectionReason,
      plan: currentPlan,
      affectedAreas: [],
    };
  }

  // Commit valid claims to main ledger
  ledger.addMessage(newMsg, ledger.messages.length + 1);
  const updatedPlan = planEvent(ledger.getActiveClaims());

  // Determine affected areas
  const affectedAreas = [];
  if (JSON.stringify(currentPlan.venue) !== JSON.stringify(updatedPlan.venue)) affectedAreas.push("venue");
  if (JSON.stringify(currentPlan.food) !== JSON.stringify(updatedPlan.food)) affectedAreas.push("food");
  if (JSON.stringify(currentPlan.judging) !== JSON.stringify(updatedPlan.judging)) affectedAreas.push("judging");
  if (JSON.stringify(currentPlan.schedule) !== JSON.stringify(updatedPlan.schedule)) affectedAreas.push("schedule");
  if (JSON.stringify(currentPlan.budget) !== JSON.stringify(updatedPlan.budget)) affectedAreas.push("budget");

  trace.logDecision(`ACCEPTED message #${newMsg.id}: Plan updated. Affected areas: [${affectedAreas.join(", ") || "none"}]. Model calls this update: reading x1. Venue/schedule/food/judging/budget: code only.`);

  return {
    accepted: true,
    plan: updatedPlan,
    affectedAreas,
  };
}
