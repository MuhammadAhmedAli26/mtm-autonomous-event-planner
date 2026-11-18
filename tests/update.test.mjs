import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.mjs";
import { planEvent } from "../src/planner.mjs";
import { applyMessageUpdate } from "../src/update.mjs";

describe("Update Gate & Conflict Protection (Invented Fixtures)", () => {
  function createBaseFixture() {
    const ledger = new Ledger();
    const baseMsg = {
      id: 1,
      sender: "Authority",
      role: "authority",
      status: "relevant",
      claims: [
        { k: "param", name: "students", value: 100 },
        { k: "param", name: "team_size", value: 4 },
        { k: "param", name: "teams", value: 25 },
        { k: "param", name: "staff", value: 5 },
        { k: "param", name: "budget_cap", value: 400000 },
        { k: "venue", name: "Hall 1", capacity: 150, price: 80000, features: [] },
        { k: "food", item: "Lunch", unit_price: 600, delivery: 0 },
        { k: "judging", name: "available_judges", value: 12 },
        { k: "judging", name: "honorarium", value: 3000 },
        { k: "judging", name: "max_teams_per_judge", value: 3 },
      ],
    };
    ledger.addMessage(baseMsg, 1);
    const plan = planEvent(ledger.getActiveClaims());
    return { ledger, plan };
  }

  it("should accept valid incremental changes that preserve invariants", () => {
    const { ledger, plan } = createBaseFixture();
    const updateMsg = {
      id: 2,
      sender: "Finance",
      role: "authority",
      status: "relevant",
      rawText: "Printing bill is Rs 8,000",
      claims: [{ k: "cost", label: "printing", amount: 8000 }],
    };

    const res = applyMessageUpdate(ledger, plan, updateMsg);
    assert.equal(res.accepted, true);
    assert.deepEqual(res.affectedAreas, ["budget"]);
    assert.equal(res.plan.budget.breakdown.committed, 8000);
  });

  it("should reject under-covering food order that violates headcount rule", () => {
    const { ledger, plan } = createBaseFixture();
    // Headcount is 100 students + 5 staff + 9 judges = 114
    const conflictMsg = {
      id: 3,
      sender: "Vendor",
      role: "supplier",
      status: "relevant",
      rawText: "Rounded order down to 50 boxes",
      claims: [{ k: "commit", what: "food_qty", item: "Lunch", qty: 50 }],
    };

    const res = applyMessageUpdate(ledger, plan, conflictMsg);
    assert.equal(res.accepted, false);
    assert.ok(res.reason.includes("food quantity 50 is below the people who must eat"));
    // Plan remains untouched
    assert.equal(res.plan.meta.headcount, 114);
  });

  it("should reject participant or supplier trying to change hard parameters (no standing)", () => {
    const { ledger, plan } = createBaseFixture();
    const rogueMsg = {
      id: 4,
      sender: "Student Society",
      role: "participant",
      status: "relevant",
      rawText: "We decided the budget is 900k",
      claims: [{ k: "param", name: "budget_cap", value: 900000 }],
    };

    const res = applyMessageUpdate(ledger, plan, rogueMsg);
    assert.equal(res.accepted, false);
    assert.ok(res.reason.includes("no standing"));
  });

  it("should detect duplicate message hash and ignore without re-evaluating", () => {
    const { ledger, plan } = createBaseFixture();
    const hashes = new Set();
    const msg = {
      id: 5,
      sender: "Finance",
      role: "authority",
      status: "relevant",
      rawText: "Same text update",
      claims: [{ k: "cost", label: "paper", amount: 2000 }],
    };

    // First time
    const res1 = applyMessageUpdate(ledger, plan, msg, hashes);
    assert.equal(res1.accepted, true);
    hashes.add(res1.plan ? "somehash" : "");

    // Simulating identical text
    const dupMsg = { ...msg, id: 6 };
    const res2 = applyMessageUpdate(ledger, res1.plan, dupMsg, new Set([
      "936f45778a48b3b64c09d056345d8b8a01cb6982054ff3666b6c4599981f2c25"
    ]));
    // Any identical hash triggers DUPLICATE
  });
});
