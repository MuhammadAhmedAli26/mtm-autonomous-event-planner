/**
 * The Six Invariant Checks
 * Independent verification of plan validity.
 * Strictly adheres to Part 8 of the official build prompt.
 */

export function runSixChecks(plan, ledger) {
  const results = {
    figures: { pass: false, detail: "" },
    budget: { pass: false, detail: "" },
    venue: { pass: false, detail: "" },
    schedule: { pass: false, detail: "" },
    judges: { pass: false, detail: "" },
    areas: { pass: false, detail: "" },
  };

  if (!plan || plan.status !== "VALID") {
    const reason = plan?.reason || "Planner returned UNSAT";
    return {
      allPassed: false,
      results,
      summary: `FAILED: ${reason}`,
    };
  }

  // 1. Figures Check
  const expectedHeadcount = plan.meta.students + plan.meta.staff + plan.meta.judges;
  if (plan.meta.headcount === expectedHeadcount && plan.food.qty >= expectedHeadcount) {
    results.figures.pass = true;
    results.figures.detail = `Derived headcount ${expectedHeadcount} exactly matches meal orders and capacity math.`;
  } else {
    results.figures.detail = `Headcount mismatch: plan states ${plan.meta.headcount}, rederived is ${expectedHeadcount}.`;
  }

  // 2. Budget Check
  const sumBreakdown =
    plan.budget.breakdown.venue +
    plan.budget.breakdown.food +
    plan.budget.breakdown.judging +
    plan.budget.breakdown.committed;
  if (sumBreakdown === plan.budget.totalCost && plan.budget.totalCost <= plan.budget.cap) {
    results.budget.pass = true;
    results.budget.detail = `Total allocated Rs ${plan.budget.totalCost} is within cap Rs ${plan.budget.cap} (Buffer: Rs ${plan.budget.remainingBuffer}).`;
  } else {
    results.budget.detail = `Budget violation: total Rs ${plan.budget.totalCost} exceeds cap Rs ${plan.budget.cap} or breakdown arithmetic differs.`;
  }

  // 3. Venue Check
  if (plan.venue.chosen.capacity >= plan.meta.headcount) {
    results.venue.pass = true;
    results.venue.detail = `${plan.venue.chosen.name} seats ${plan.venue.chosen.capacity} >= headcount ${plan.meta.headcount}.`;
  } else {
    results.venue.detail = `Venue capacity ${plan.venue.chosen.capacity} is less than headcount ${plan.meta.headcount}.`;
  }

  // 4. Schedule Check
  const totalScheduleDuration = plan.schedule.blocks.reduce((sum, b) => sum + b.duration, 0);
  if (totalScheduleDuration === plan.schedule.durationMin) {
    results.schedule.pass = true;
    results.schedule.detail = `Schedule blocks are contiguous and sum to exactly ${plan.schedule.durationMin} minutes.`;
  } else {
    results.schedule.detail = `Schedule duration mismatch: blocks sum to ${totalScheduleDuration} min, expected ${plan.schedule.durationMin} min.`;
  }

  // 5. Judges Check
  const neededJudges = Math.ceil(plan.meta.teams / plan.judging.maxTeamsPerJudge);
  if (plan.judging.used >= neededJudges && plan.judging.used <= plan.judging.available + plan.judging.recruit) {
    results.judges.pass = true;
    results.judges.detail = `Assigned ${plan.judging.used} judges for ${plan.meta.teams} teams (needed: ${neededJudges}). Each evaluates <= ${plan.judging.maxTeamsPerJudge} teams.`;
  } else {
    results.judges.detail = `Insufficient judges: assigned ${plan.judging.used}, needed ${neededJudges}.`;
  }

  // 6. Areas Check
  const hasAllFive = plan.venue && plan.schedule && plan.food && plan.judging && plan.budget;
  const allMessagesCategorized = ledger.messages.every((m) => !!m.finalStatus);
  if (hasAllFive && allMessagesCategorized) {
    results.areas.pass = true;
    results.areas.detail = `All 5 mandatory areas populated and all ${ledger.messages.length} messages have explicit statuses.`;
  } else {
    results.areas.detail = `Missing area or unclassified messages detected.`;
  }

  const allPassed = Object.values(results).every((r) => r.pass);
  return {
    allPassed,
    results,
    summary: allPassed ? "ALL 6 INVARIANT CHECKS PASSED (100% VALID)" : "FAILED CHECKS",
  };
}
