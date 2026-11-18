#!/usr/bin/env node

/**
 * Main CLI Entrypoint: node plan.mjs <file>
 * Strictly adheres to Part 10 of the official build prompt.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { readMessages } from "./src/reader.mjs";
import { Ledger } from "./src/ledger.mjs";
import { planEvent } from "./src/planner.mjs";
import { runSixChecks } from "./src/checks.mjs";
import { applyMessageUpdate } from "./src/update.mjs";
import { trace } from "./src/trace.mjs";
import { renderPlanText, renderMessageTable } from "./src/render.mjs";

const STATE_DIR = path.resolve(process.cwd(), "state");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const OUT_DIR = path.resolve(process.cwd(), "out");
const HISTORY_DIR = path.join(OUT_DIR, "history");

function ensureDirs() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      const ledger = new Ledger();
      ledger.messages = data.messages || [];
      ledger.slots = new Map(data.slots || []);
      ledger.supersededClaims = data.supersededClaims || [];
      return {
        ledger,
        plan: data.plan,
        processedHashes: new Set(data.processedHashes || []),
      };
    } catch {
      return null;
    }
  }
  return null;
}

function saveState(ledger, plan, processedHashes) {
  ensureDirs();
  const stateData = {
    messages: ledger.messages,
    slots: Array.from(ledger.slots.entries()),
    supersededClaims: ledger.supersededClaims,
    plan,
    processedHashes: Array.from(processedHashes),
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateData, null, 2), "utf-8");
}

function saveOutputs(planText, traceText, msgTableText, planObj) {
  ensureDirs();
  const fullReport = `${planText}\n\n${traceText}\n\n${msgTableText}\n`;
  fs.writeFileSync(path.join(OUT_DIR, "plan.json"), JSON.stringify(planObj, null, 2), "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "trace.txt"), traceText, "utf-8");
  fs.writeFileSync(path.join(OUT_DIR, "final_report.txt"), fullReport, "utf-8");

  // Historical run archive
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(HISTORY_DIR, `run_${timestamp}.txt`), fullReport, "utf-8");
}

async function main() {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error("Usage: node plan.mjs <messages-file.txt>");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), targetFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(resolvedPath, "utf-8");
  const existingState = loadState();

  let knownLabels = [];
  if (existingState?.ledger) {
    knownLabels = existingState.ledger.getKnownLabels();
  }

  // Phase 1: Call Reader once
  const readResult = await readMessages(rawText, knownLabels);
  const incomingMessages = readResult.messages || [];

  // Stale-state rule: agar input me >=5 messages hain aur kisi ka hash state me nahi, state archive kar ke fresh run.
  let isStale = false;
  if (existingState && incomingMessages.length >= 5) {
    const hasAnyHash = incomingMessages.some((m) => {
      const h = crypto.createHash("sha256").update((m.rawText || "").trim().toLowerCase()).digest("hex");
      return existingState.processedHashes.has(h);
    });
    if (!hasAnyHash) {
      isStale = true;
      ensureDirs();
      const archivePath = path.join(HISTORY_DIR, `archive_stale_state_${Date.now()}.json`);
      fs.writeFileSync(archivePath, JSON.stringify(existingState, null, 2), "utf-8");
      trace.logDecision(`Stale state detected (>=5 messages with 0 matching hashes). Previous state archived to ${path.basename(archivePath)}.`);
    }
  }

  // Mode detection: If state exists AND NOT stale AND incoming messages <= 3 -> UPDATE mode. Otherwise -> NEW PACK.
  const isUpdateMode = existingState && !isStale && incomingMessages.length <= 3;

  let ledger;
  let currentPlan;
  let processedHashes;

  if (isUpdateMode) {
    ledger = existingState.ledger;
    currentPlan = existingState.plan;
    processedHashes = existingState.processedHashes;

    for (const msg of incomingMessages) {
      const res = applyMessageUpdate(ledger, currentPlan, msg, processedHashes);
      currentPlan = res.plan;
    }
  } else {
    // Fresh New Pack
    ledger = new Ledger();
    processedHashes = new Set();

    let pos = 1;
    for (const msg of incomingMessages) {
      ledger.addMessage(msg, pos++);
    }

    currentPlan = planEvent(ledger.getActiveClaims());
  }

  const sixChecks = runSixChecks(currentPlan, ledger);
  saveState(ledger, currentPlan, processedHashes);

  // Formatting
  const planText = renderPlanText(currentPlan, sixChecks);
  const traceText = trace.formatTraceText();
  const msgTableText = renderMessageTable(ledger.messages);

  saveOutputs(planText, traceText, msgTableText, currentPlan);

  // Print in official required order: PLAN, then TRACE, then MESSAGE TABLE
  console.log(planText);
  console.log("");
  console.log(traceText);
  console.log(msgTableText);
}

main().catch((err) => {
  console.error("Fatal Runner Error:", err);
  process.exit(1);
});
