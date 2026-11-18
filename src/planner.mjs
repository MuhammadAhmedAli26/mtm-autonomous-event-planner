/**
 * Deterministic Event Planner
 * Pure mathematics and logic solver.
 * Strictly adheres to Part 7 of the official build prompt.
 */

import fs from "fs";
import path from "path";

function loadAssumptions() {
  const p = path.resolve(process.cwd(), "config", "assumptions.json");
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return {
    start_time: "10:00",
    opening_duration_min: 15,
    closing_duration_min: 15,
    meal_duration_min: 15,
    prayer_break_min: 15,
    team_size: 3,
    minutes_per_team: 15,
    max_teams_per_judge: 3,
    honorarium_pkr: 5000,
  };
}

export function planEvent(claims) {
  const assumptions = loadAssumptions();
  const notesNotEnforced = [];

  // 1. Extract parameters
  const params = {};
  const costs = [];
  const venues = [];
  const foods = [];
  const judgingParams = {};
  const rules = [];
  const extras = [];
  const availability = [];

  for (const c of claims) {
    if (c.k === "param") params[c.name] = c.value;
    else if (c.k === "cost") costs.push(c);
    else if (c.k === "extra" && c.approved) costs.push(c);
    else if (c.k === "venue") venues.push(c);
    else if (c.k === "food") foods.push(c);
    else if (c.k === "judging") judgingParams[c.name] = c.value;
    else if (c.k === "rule") rules.push(c);
    else if (c.k === "extra" && !c.approved) extras.push(c);
    else if (c.k === "availability") availability.push(c);
    else if (c.k === "note") notesNotEnforced.push(c);
  }

  const students = params.students ?? 150;
  let teamSize = params.team_size ?? assumptions.team_size;
  let teams = params.teams;

  // Sanity check: if teams is tiny (e.g. 3) while students is large (e.g. 150),
  // then 'teams of 3' was parsed into teams instead of team_size
  if (teams && teams <= 10 && students >= 30 && students % teams === 0) {
    teamSize = teams;
    teams = Math.ceil(students / teamSize);
  } else if (!teams) {
    teams = Math.ceil(students / teamSize);
  }
  const staff = params.staff ?? 10;
  const budgetCap = params.budget_cap ?? 650000;
  const durationMin = params.duration_min ?? 240;

  // Judging calculations
  const maxTeamsPerJudge = judgingParams.max_teams_per_judge ?? assumptions.max_teams_per_judge;
  const minutesPerTeam = judgingParams.minutes_per_team ?? assumptions.minutes_per_team;
  const honorarium = judgingParams.honorarium ?? assumptions.honorarium_pkr;
  const availableJudges = judgingParams.available_judges ?? 20;

  const neededJudges = Math.ceil(teams / maxTeamsPerJudge);
  const usedJudges = neededJudges;
  const recruitJudges = Math.max(0, usedJudges - availableJudges);
  const totalJudgingCost = usedJudges * honorarium;

  // Headcount calculation
  const totalHeadcount = students + staff + usedJudges;

  // 2. Venue solver
  const requiredFeatures = rules
    .filter((r) => r.type === "venue_feature")
    .map((r) => r.feature.toLowerCase());
  
  // Default capacity margin fill factor
  const marginRule = rules.find((r) => r.type === "capacity_margin");
  const maxFill = marginRule?.max_fill ?? 1.0;

  const validVenues = [];
  const rejectedVenues = [];

  for (const v of venues) {
    const effectiveCap = v.capacity * maxFill;
    const hasRequiredFeatures = requiredFeatures.every((f) =>
      (v.features || []).some((vf) => vf.toLowerCase().includes(f))
    );

    if (effectiveCap < totalHeadcount) {
      rejectedVenues.push({ name: v.name, reason: `Capacity ${v.capacity} cannot seat headcount ${totalHeadcount}` });
    } else if (!hasRequiredFeatures) {
      rejectedVenues.push({ name: v.name, reason: `Missing required features: ${requiredFeatures.join(", ")}` });
    } else {
      validVenues.push(v);
    }
  }

  if (validVenues.length === 0) {
    return {
      status: "UNSAT",
      reason: `No venue satisfies capacity ${totalHeadcount} and required features (${requiredFeatures.join(", ")})`,
      cheapestAlternative: venues.sort((a, b) => a.price - b.price)[0] || null,
    };
  }

  // Pick lowest price (tie-break: larger capacity)
  validVenues.sort((a, b) => a.price - b.price || b.capacity - a.capacity);
  const chosenVenue = validVenues[0];

  // 3. Committed Costs sum
  let committedCostsTotal = costs.reduce((sum, c) => sum + c.amount, 0);

  // 4. Food solver (choose tier that fits budget cap)
  const minOrderRule = rules.find((r) => r.type === "min_order");
  const minOrder = minOrderRule ? minOrderRule.qty : 0;
  const foodQty = Math.max(totalHeadcount, minOrder);

  // Dietary share rule (e.g. vegetarian percentage)
  const dietaryRule = rules.find((r) => r.type === "dietary_share");
  let dietaryBreakdown = null;
  if (dietaryRule && dietaryRule.pct) {
    const vegCount = Math.ceil(foodQty * (dietaryRule.pct / 100));
    dietaryBreakdown = {
      standardQty: foodQty - vegCount,
      specialQty: vegCount,
      specialLabel: dietaryRule.label || "Vegetarian",
    };
  }

  // Sort tiers from highest price to lowest price
  foods.sort((a, b) => b.unit_price - a.unit_price);
  let chosenFood = foods[0] || { item: "Standard Lunch Box", unit_price: 1200, delivery: 0 };
  let foodTotal = foodQty * chosenFood.unit_price + (chosenFood.delivery || 0);

  // Surcharge / Tax % solver
  const surchargeRules = rules.filter((r) => r.type === "surcharge" || r.type === "tax");
  let totalSurcharges = 0;
  for (const s of surchargeRules) {
    const appliesTo = s.applies_to || "all";
    let base = 0;
    if (appliesTo === "food" || appliesTo === "all") base += foodTotal;
    if (appliesTo === "venue" || appliesTo === "all") base += chosenVenue.price;
    if (appliesTo === "judging" || appliesTo === "all") base += totalJudgingCost;
    if (s.pct) totalSurcharges += Math.round(base * (s.pct / 100));
    if (s.flat) totalSurcharges += s.flat;
  }

  // Budget repair ladder
  let totalCost = committedCostsTotal + chosenVenue.price + totalJudgingCost + foodTotal + totalSurcharges;
  if (totalCost > budgetCap && foods.length > 1) {
    for (let i = 1; i < foods.length; i++) {
      chosenFood = foods[i];
      foodTotal = foodQty * chosenFood.unit_price + (chosenFood.delivery || 0);
      let newSurcharge = 0;
      for (const s of surchargeRules) {
        const appliesTo = s.applies_to || "all";
        let base = 0;
        if (appliesTo === "food" || appliesTo === "all") base += foodTotal;
        if (appliesTo === "venue" || appliesTo === "all") base += chosenVenue.price;
        if (appliesTo === "judging" || appliesTo === "all") base += totalJudgingCost;
        if (s.pct) newSurcharge += Math.round(base * (s.pct / 100));
        if (s.flat) newSurcharge += s.flat;
      }
      totalCost = committedCostsTotal + chosenVenue.price + totalJudgingCost + foodTotal + newSurcharge;
      if (totalCost <= budgetCap) break;
    }
  }

  if (totalCost > budgetCap) {
    return {
      status: "UNSAT",
      reason: `Total cost Rs ${totalCost} exceeds budget cap Rs ${budgetCap} even with cheapest food option`,
      cheapestTotal: totalCost,
    };
  }

  // Judge shortage check: if needed judges exceed confirmed available without authorized recruitment
  const canRecruit = params.allow_recruitment ?? false;
  if (neededJudges > availableJudges && !canRecruit) {
    return {
      status: "UNSAT",
      reason: `Judges required (${neededJudges}) exceeds confirmed available pool (${availableJudges}) and recruitment is not authorized`,
    };
  }

  // 5. Schedule Solver
  const rounds = Math.ceil(teams / usedJudges);
  const judgingDurationMin = rounds * minutesPerTeam;
  const openingMin = assumptions.opening_duration_min;
  const closingMin = assumptions.closing_duration_min;
  const mealMin = assumptions.meal_duration_min;

  // Additional required rule blocks (e.g. prayer break)
  const blockRules = rules.filter((r) => r.type === "block");
  let fixedBlocksDuration = 0;
  const scheduleBlocks = [];

  for (const br of blockRules) {
    fixedBlocksDuration += br.minutes;
  }

  const buildDurationMin = durationMin - (openingMin + closingMin + mealMin + fixedBlocksDuration + judgingDurationMin);
  if (buildDurationMin < 60) {
    return {
      status: "UNSAT",
      reason: `Schedule duration ${durationMin} min is too short to fit hacking sprint after required blocks and judging`,
    };
  }

  let currentMin = 0;
  const formatTime = (offsetMin) => {
    const startHour = parseInt(assumptions.start_time.split(":")[0], 10);
    const startM = parseInt(assumptions.start_time.split(":")[1], 10);
    const totalM = startHour * 60 + startM + offsetMin;
    const h = Math.floor(totalM / 60) % 24;
    const m = totalM % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  scheduleBlocks.push({
    name: "Opening & Kickoff",
    start: formatTime(currentMin),
    duration: openingMin,
    isAssumption: true,
  });
  currentMin += openingMin;

  scheduleBlocks.push({
    name: "Active Hacking Sprint",
    start: formatTime(currentMin),
    duration: buildDurationMin,
  });
  currentMin += buildDurationMin;

  for (const br of blockRules) {
    scheduleBlocks.push({
      name: br.label || "Mandatory Break",
      start: formatTime(currentMin),
      duration: br.minutes,
      isMandatory: true,
    });
    currentMin += br.minutes;
  }

  scheduleBlocks.push({
    name: `Parallel Judging (${usedJudges} judges x ${rounds} rounds)`,
    start: formatTime(currentMin),
    duration: judgingDurationMin,
  });
  currentMin += judgingDurationMin;

  // Window rules check (e.g. meal window)
  const windowRules = rules.filter((r) => r.type === "window");
  for (const wr of windowRules) {
    if (wr.what === "meal" || wr.what === "lunch") {
      const parseClock = (s) => {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m;
      };
      const mealStartOffset = currentMin;
      const startHour = parseInt(assumptions.start_time.split(":")[0], 10);
      const startM = parseInt(assumptions.start_time.split(":")[1], 10);
      const eventMealMin = startHour * 60 + startM + mealStartOffset;
      const windowStart = parseClock(wr.from);
      const windowEnd = parseClock(wr.to);
      if (eventMealMin < windowStart || eventMealMin > windowEnd) {
        return {
          status: "UNSAT",
          reason: `Meal timing falls outside required window ${wr.from} - ${wr.to}`,
        };
      }
    }
  }

  scheduleBlocks.push({
    name: "Lunch & Closing Ceremony",
    start: formatTime(currentMin),
    duration: closingMin + mealMin,
    isAssumption: true,
  });

  return {
    status: "VALID",
    meta: {
      headcount: totalHeadcount,
      students,
      staff,
      judges: usedJudges,
      teams,
    },
    venue: {
      chosen: chosenVenue,
      rejected: rejectedVenues,
      reason: `Lowest cost venue fitting headcount ${totalHeadcount} and required features`,
    },
    food: {
      chosen: chosenFood,
      qty: foodQty,
      deliveryCost: chosenFood.delivery || 0,
      totalCost: foodTotal,
      reason: `Package selected to feed ${foodQty} attendees within budget cap`,
    },
    judging: {
      needed: neededJudges,
      used: usedJudges,
      available: availableJudges,
      recruit: recruitJudges,
      honorarium,
      totalCost: totalJudgingCost,
      rounds,
      minutesPerTeam,
      maxTeamsPerJudge,
    },
    budget: {
      cap: budgetCap,
      totalCost,
      remainingBuffer: budgetCap - totalCost,
      committedCosts: costs,
      breakdown: {
        venue: chosenVenue.price,
        food: foodTotal,
        judging: totalJudgingCost,
        committed: committedCostsTotal,
      },
    },
    schedule: {
      durationMin,
      startTime: assumptions.start_time,
      blocks: scheduleBlocks,
      assumptions: ["Opening: 15 min", "Closing: 15 min", "Lunch: 15 min"],
    },
    notesNotEnforced,
  };
}
