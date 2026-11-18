/**
 * Render Module
 * Unified text formatting for Terminal and UI.
 * Strictly adheres to Part 10 of the official build prompt.
 */

export function renderPlanText(plan, sixChecks) {
  const lines = [];
  lines.push("================================================================================");
  lines.push("MIND TO MACHINE HACKATHON 2026 — AUTONOMOUS 5-AREA EVENT PLAN");
  lines.push("================================================================================");

  if (plan.status !== "VALID") {
    lines.push(`STATUS: INVALID / UNSAT`);
    lines.push(`REASON: ${plan.reason}`);
    lines.push("================================================================================");
    return lines.join("\n");
  }

  // Meta Summary
  lines.push(`EVENT TARGET: 4-Hour Physical Hackathon in Islamabad`);
  lines.push(`HEADCOUNT:    ${plan.meta.headcount} people (${plan.meta.students} students in ${plan.meta.teams} teams, ${plan.meta.staff} staff, ${plan.meta.judges} judges)`);
  lines.push(`BUDGET:       Rs ${plan.budget.totalCost.toLocaleString()} allocated / Rs ${plan.budget.cap.toLocaleString()} cap (Buffer: Rs ${plan.budget.remainingBuffer.toLocaleString()})`);
  lines.push("");

  // 1. Venue
  lines.push("1. VENUE PLAN:");
  lines.push(`   - Selected Hall:      ${plan.venue.chosen.name}`);
  lines.push(`   - Capacity:           ${plan.venue.chosen.capacity} seats (Headcount: ${plan.meta.headcount})`);
  lines.push(`   - Features:           ${(plan.venue.chosen.features || []).join(", ") || "Standard"}`);
  lines.push(`   - Cost:               Rs ${plan.venue.chosen.price.toLocaleString()}`);
  lines.push(`   - Selection Why:      ${plan.venue.reason}`);
  if (plan.venue.rejected && plan.venue.rejected.length > 0) {
    lines.push(`   - Rejected Venues:`);
    for (const r of plan.venue.rejected) {
      lines.push(`     * ${r.name}: ${r.reason}`);
    }
  }
  lines.push("");

  // 2. Food
  lines.push("2. FOOD PLAN:");
  lines.push(`   - Selected Tier:      ${plan.food.chosen.item}`);
  lines.push(`   - Headcount to Feed:  ${plan.food.qty} boxes`);
  lines.push(`   - Unit Price:         Rs ${plan.food.chosen.unit_price.toLocaleString()} / head`);
  lines.push(`   - Delivery:           ${plan.food.deliveryCost === 0 ? "FREE" : "Rs " + plan.food.deliveryCost.toLocaleString()}`);
  lines.push(`   - Total Food Cost:    Rs ${plan.food.totalCost.toLocaleString()}`);
  lines.push(`   - Selection Why:      ${plan.food.reason}`);
  lines.push("");

  // 3. Judging
  lines.push("3. JUDGING PLAN:");
  lines.push(`   - Student Teams:      ${plan.meta.teams} teams (${plan.judging.maxTeamsPerJudge} teams max / judge)`);
  lines.push(`   - Judges Required:    ${plan.judging.needed} judges (ceil(${plan.meta.teams} / ${plan.judging.maxTeamsPerJudge}))`);
  lines.push(`   - Judges Assigned:    ${plan.judging.used} (${plan.judging.available} confirmed available, ${plan.judging.recruit} recruited)`);
  lines.push(`   - Honorarium:         Rs ${plan.judging.honorarium.toLocaleString()} / judge`);
  lines.push(`   - Total Honorarium:   Rs ${plan.judging.totalCost.toLocaleString()}`);
  lines.push(`   - Judging Rounds:     ${plan.judging.rounds} rounds (${plan.judging.minutesPerTeam} min / team)`);
  lines.push("");

  // 4. Budget
  lines.push("4. BUDGET PLAN:");
  lines.push(`   - Cap:                Rs ${plan.budget.cap.toLocaleString()}`);
  lines.push(`   - Total Allocated:    Rs ${plan.budget.totalCost.toLocaleString()}`);
  lines.push(`   - Remaining Buffer:   Rs ${plan.budget.remainingBuffer.toLocaleString()}`);
  lines.push(`   - Itemized Breakdown:`);
  lines.push(`     * Venue (${plan.venue.chosen.name})           : Rs ${plan.budget.breakdown.venue.toLocaleString()}`);
  lines.push(`     * Food (${plan.food.chosen.item})   : Rs ${plan.budget.breakdown.food.toLocaleString()}`);
  lines.push(`     * Judging Honoraria (${plan.judging.used} judges) : Rs ${plan.budget.breakdown.judging.toLocaleString()}`);
  for (const c of plan.budget.committedCosts) {
    lines.push(`     * Committed: ${c.label.padEnd(23)}: Rs ${c.amount.toLocaleString()}`);
  }
  lines.push("");

  // 5. Schedule
  lines.push("5. SCHEDULE PLAN (4-Hour Timeline):");
  lines.push(`   - Total Duration:     ${plan.schedule.durationMin} minutes`);
  lines.push(`   - Start Time:         ${plan.schedule.startTime}`);
  for (const b of plan.schedule.blocks) {
    const tag = b.isMandatory ? "[MANDATORY]" : b.isAssumption ? "[ASSUMPTION]" : "";
    lines.push(`   - ${b.start.padEnd(9)} (${b.duration.toString().padStart(3)} min) : ${b.name} ${tag}`);
  }
  lines.push("");

  // Invariant Checks
  lines.push("--------------------------------------------------------------------------------");
  lines.push(`INVARIANT VERIFICATION: ${sixChecks.summary}`);
  lines.push("--------------------------------------------------------------------------------");
  lines.push(`1. Figures  : [${sixChecks.results.figures.pass ? "PASS" : "FAIL"}] ${sixChecks.results.figures.detail}`);
  lines.push(`2. Budget   : [${sixChecks.results.budget.pass ? "PASS" : "FAIL"}] ${sixChecks.results.budget.detail}`);
  lines.push(`3. Venue    : [${sixChecks.results.venue.pass ? "PASS" : "FAIL"}] ${sixChecks.results.venue.detail}`);
  lines.push(`4. Schedule : [${sixChecks.results.schedule.pass ? "PASS" : "FAIL"}] ${sixChecks.results.schedule.detail}`);
  lines.push(`5. Judges   : [${sixChecks.results.judges.pass ? "PASS" : "FAIL"}] ${sixChecks.results.judges.detail}`);
  lines.push(`6. Areas    : [${sixChecks.results.areas.pass ? "PASS" : "FAIL"}] ${sixChecks.results.areas.detail}`);
  lines.push("================================================================================");

  return lines.join("\n");
}

export function renderMessageTable(messages) {
  const lines = [];
  lines.push("");
  lines.push("================================================================================");
  lines.push("MESSAGES AUDIT TABLE");
  lines.push("================================================================================");
  lines.push(`ID | Status        | Sender                      | Why / Outcome`);
  lines.push(`---+---------------+-----------------------------+------------------------------`);

  for (const m of messages) {
    const id = (m.id || "").toString().padEnd(2);
    const status = (m.finalStatus || "UNKNOWN").padEnd(13);
    const sender = (m.sender || "Unknown").slice(0, 27).padEnd(27);
    const reason = m.rejectionReason || m.why || "";
    lines.push(`${id} | ${status} | ${sender} | ${reason}`);
  }

  lines.push("================================================================================");
  return lines.join("\n");
}
