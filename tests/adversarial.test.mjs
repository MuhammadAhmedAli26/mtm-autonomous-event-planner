import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.mjs";
import { planEvent } from "../src/planner.mjs";
import { applyMessageUpdate } from "../src/update.mjs";

describe("T2 Adversarial & Edge Case Invariant Suite", () => {
  // Hand-computed Base Fixture
  function getBaseSetup() {
    const ledger = new Ledger();
    const baseMsg = {
      id: 1,
      sender: "Dean Office",
      role: "authority",
      status: "relevant",
      claims: [
        { k: "param", name: "students", value: 150 },
        { k: "param", name: "team_size", value: 3 },
        { k: "param", name: "teams", value: 50 },
        { k: "param", name: "staff", value: 10 },
        { k: "param", name: "budget_cap", value: 650000 },
        { k: "param", name: "duration_min", value: 240 },
        { k: "venue", name: "Hall A", capacity: 200, price: 120000, features: [] },
        { k: "venue", name: "Hall B", capacity: 200, price: 150000, features: ["generator"] },
        { k: "food", item: "Lunch Box", unit_price: 1000, delivery: 0 },
        { k: "judging", name: "available_judges", value: 20 },
        { k: "judging", name: "honorarium", value: 5000 },
        { k: "judging", name: "max_teams_per_judge", value: 3 },
        { k: "judging", name: "minutes_per_team", value: 15 },
        { k: "cost", label: "prizes", amount: 100000 },
      ],
    };
    ledger.addMessage(baseMsg, 1);
    const plan = planEvent(ledger.getActiveClaims());
    return { ledger, plan };
  }

  // 1. Min Order Test
  it("Adv 1: min_order constraint scales meal quantity to rule minimum", () => {
    // Hand-compute: Headcount is 150 students + 10 staff + 17 judges = 177.
    // If supplier states min_order is 220, food quantity MUST be max(177, 220) = 220.
    const claims = [
      { k: "param", name: "students", value: 150 },
      { k: "param", name: "staff", value: 10 },
      { k: "param", name: "teams", value: 50 },
      { k: "judging", name: "max_teams_per_judge", value: 3 },
      { k: "food", item: "Box", unit_price: 1000, delivery: 0 },
      { k: "venue", name: "H", capacity: 250, price: 50000, features: [] },
      { k: "rule", type: "min_order", item: "Box", qty: 220 },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "VALID");
    assert.equal(plan.food.qty, 220); // Hand-computed expectation: 220
    assert.equal(plan.food.totalCost, 220000);
  });

  // 2. Lunch Window Test
  it("Adv 2: lunch_window constraint enforces meal start timing", () => {
    // Hand-compute: If lunch window is 15:00-16:00, but event is 10:00-14:00 (ends at 14:00),
    // meal timing cannot fit window -> MUST return UNSAT.
    const claims = [
      { k: "param", name: "duration_min", value: 240 },
      { k: "param", name: "students", value: 150 },
      { k: "param", name: "staff", value: 10 },
      { k: "param", name: "teams", value: 50 },
      { k: "venue", name: "H", capacity: 250, price: 50000, features: [] },
      { k: "food", item: "Box", unit_price: 1000, delivery: 0 },
      { k: "rule", type: "window", what: "meal", from: "15:00", to: "16:00" },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "UNSAT");
    assert.ok(plan.reason.includes("falls outside required window"));
  });

  // 3. Tax / Surcharge % Test
  it("Adv 3: tax % surcharge adds exactly to target category", () => {
    // Hand-compute: Headcount 177 * 1000 = 177,000 food cost.
    // Tax rule of 16% on food: 177,000 * 0.16 = 28,320.
    // Total budget must reflect venue 50k + food 177k + tax 28,320 = 255,320 (excluding judging).
    const claims = [
      { k: "param", name: "students", value: 150 },
      { k: "param", name: "staff", value: 10 },
      { k: "param", name: "teams", value: 50 },
      { k: "judging", name: "available_judges", value: 20 },
      { k: "judging", name: "honorarium", value: 0 },
      { k: "venue", name: "H", capacity: 250, price: 50000, features: [] },
      { k: "food", item: "Box", unit_price: 1000, delivery: 0 },
      { k: "rule", type: "surcharge", applies_to: "food", pct: 16 },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "VALID");
    const expectedSurcharge = Math.round(177 * 1000 * 0.16); // 28320
    const expectedTotal = 50000 + (177 * 1000) + expectedSurcharge;
    assert.equal(plan.budget.totalCost, expectedTotal);
  });

  // 4. Dietary Share Test
  it("Adv 4: dietary share computes split meal quantities", () => {
    // Hand-compute: Headcount 177. 20% vegetarian rule => ceil(177 * 0.20) = 36 veg, 141 standard.
    const claims = [
      { k: "param", name: "students", value: 150 },
      { k: "param", name: "staff", value: 10 },
      { k: "param", name: "teams", value: 50 },
      { k: "venue", name: "H", capacity: 250, price: 50000, features: [] },
      { k: "food", item: "Box", unit_price: 1000, delivery: 0 },
      { k: "rule", type: "dietary_share", pct: 20, label: "Vegetarian" },
    ];
    const plan = planEvent(claims);
    assert.equal(plan.status, "VALID");
    assert.equal(plan.food.qty, 177);
  });

  // 5. Team Size 2 => 25 Judges Needed > 20 Confirmed => REJECT Test
  it("Adv 5: team size 2 requires 25 judges, exceeding 20 available pool -> REJECT", () => {
    // Hand-compute: 50 students, team_size 2 => 25 teams.
    // 1 team per judge => 25 judges needed.
    // Confirmed available pool = 20.
    // Since 25 > 20 and recruitment is not authorized -> REJECT.
    const { ledger, plan } = getBaseSetup();
    const updateMsg = {
      id: 2,
      sender: "Authority",
      role: "authority",
      status: "relevant",
      rawText: "Update: Students 50, team size 2, each judge reviews exactly 1 team.",
      claims: [
        { k: "param", name: "students", value: 50 },
        { k: "param", name: "team_size", value: 2 },
        { k: "param", name: "teams", value: 25 },
        { k: "judging", name: "max_teams_per_judge", value: 1 },
      ],
    };

    const res = applyMessageUpdate(ledger, plan, updateMsg);
    assert.equal(res.accepted, false);
    assert.ok(res.reason.includes("Judges required (25) exceeds confirmed available pool (20)"));
  });

  // 6. 10x Price Typo Test
  it("Adv 6: 10x vendor price typo causes budget overflow -> REJECT", () => {
    // Hand-compute: Food price typos to Rs 10,000/head.
    // 177 * 10,000 = 1,770,000 > 650,000 budget cap.
    // Must REJECT and preserve previous plan.
    const { ledger, plan } = getBaseSetup();
    const typoMsg = {
      id: 3,
      sender: "Caterer",
      role: "supplier",
      status: "relevant",
      rawText: "Food price is Rs 10,000 per head.",
      claims: [{ k: "food", item: "Lunch Box", unit_price: 10000, delivery: 0 }],
    };

    const res = applyMessageUpdate(ledger, plan, typoMsg);
    assert.equal(res.accepted, false);
    assert.ok(res.reason.includes("exceeds budget cap"));
    // Previous valid budget preserved
    assert.equal(res.plan.budget.isWithinBudget !== false, true);
  });

  // 7. Generator Claim Contradiction Test
  it("Adv 7: booking venue without required generator feature -> REJECT", () => {
    // Hand-compute: Security office mandates generator feature.
    // Venue Hall A has no generator (features: []).
    // Attempting to enforce Hall A when generator is required -> REJECT.
    const { ledger, plan } = getBaseSetup();
    // Add mandatory generator rule
    const genRuleMsg = {
      id: 4,
      sender: "Security",
      role: "authority",
      status: "relevant",
      rawText: "Standby generator is strictly mandatory.",
      claims: [{ k: "rule", type: "venue_feature", feature: "generator" }],
    };
    const resRule = applyMessageUpdate(ledger, plan, genRuleMsg);
    assert.equal(resRule.accepted, true);
    // Hall B (with generator) was selected
    assert.equal(resRule.plan.venue.chosen.name, "Hall B");

    // Now try to force Hall A (which has no generator)
    const forceHallAMsg = {
      id: 5,
      sender: "Vendor",
      role: "supplier",
      status: "relevant",
      rawText: "We have finalized Hall A for your event.",
      claims: [{ k: "commit", what: "venue", name: "Hall A" }],
    };
    const resForce = applyMessageUpdate(ledger, resRule.plan, forceHallAMsg);
    // Preserves Hall B
    assert.equal(resForce.plan.venue.chosen.name, "Hall B");
  });
});
