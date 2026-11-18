import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planEvent } from "../src/planner.mjs";
import { runSixChecks } from "../src/checks.mjs";
import { Ledger } from "../src/ledger.mjs";

describe("Deterministic Planner & Six Invariant Checks (Invented Fixtures)", () => {
  it("should solve a valid event with invented numbers", () => {
    const claims = [
      { k: "param", name: "students", value: 120 },
      { k: "param", name: "team_size", value: 4 },
      { k: "param", name: "teams", value: 30 },
      { k: "param", name: "staff", value: 8 },
      { k: "param", name: "budget_cap", value: 500000 },
      { k: "param", name: "duration_min", value: 240 },
      { k: "cost", label: "badges", amount: 12000 },
      {
        k: "venue",
        name: "Alpha Hall",
        capacity: 150,
        price: 90000,
        features: ["generator", "ac"],
      },
      {
        k: "food",
        item: "Deluxe Box",
        unit_price: 950,
        delivery: 0,
      },
      {
        k: "judging",
        name: "available_judges",
        value: 15,
      },
      {
        k: "judging",
        name: "honorarium",
        value: 4000,
      },
      {
        k: "judging",
        name: "minutes_per_team",
        value: 15,
      },
      {
        k: "judging",
        name: "max_teams_per_judge",
        value: 3,
      },
      {
        k: "rule",
        type: "block",
        label: "tea_break",
        minutes: 15,
      },
    ];

    const plan = planEvent(claims);
    assert.equal(plan.status, "VALID");

    // Headcount = 120 + 8 + ceil(30/3 = 10) = 138
    assert.equal(plan.meta.headcount, 138);
    assert.equal(plan.meta.teams, 30);
    assert.equal(plan.judging.needed, 10);
    assert.equal(plan.judging.used, 10);
    assert.equal(plan.judging.totalCost, 40000);

    // Food = 138 * 950 = 131,100
    assert.equal(plan.food.totalCost, 131100);

    // Budget = 12000 + 90000 + 40000 + 131100 = 273,100 <= 500,000
    assert.equal(plan.budget.totalCost, 273100);
    assert.ok(plan.budget.remainingBuffer > 0);

    // Invariant check runner
    const ledger = new Ledger();
    ledger.messages = [{ id: 1, finalStatus: "USED" }];
    const checks = runSixChecks(plan, ledger);
    assert.equal(checks.allPassed, true);
    assert.equal(checks.results.figures.pass, true);
    assert.equal(checks.results.budget.pass, true);
    assert.equal(checks.results.venue.pass, true);
    assert.equal(checks.results.schedule.pass, true);
    assert.equal(checks.results.judges.pass, true);
    assert.equal(checks.results.areas.pass, true);
  });

  it("should return UNSAT when all venue capacities are below headcount", () => {
    const claims = [
      { k: "param", name: "students", value: 300 },
      { k: "param", name: "staff", value: 20 },
      { k: "param", name: "teams", value: 100 },
      { k: "venue", name: "Tiny Room", capacity: 100, price: 30000, features: [] },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "UNSAT");
    assert.ok(plan.reason.includes("No venue satisfies capacity"));
  });

  it("should return UNSAT when total cost exceeds budget cap", () => {
    const claims = [
      { k: "param", name: "students", value: 100 },
      { k: "param", name: "staff", value: 10 },
      { k: "param", name: "budget_cap", value: 50000 },
      { k: "cost", label: "committed_expenses", amount: 60000 },
      { k: "venue", name: "Hall", capacity: 200, price: 40000, features: [] },
      { k: "food", item: "Rice", unit_price: 500, delivery: 0 },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "UNSAT");
    assert.ok(plan.reason.includes("exceeds budget cap"));
  });
});
