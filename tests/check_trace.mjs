import fs from "fs";
import path from "path";
import assert from "node:assert/strict";

const tracePath = path.resolve(process.cwd(), "out", "trace.txt");
if (!fs.existsSync(tracePath)) {
  console.error("Error: out/trace.txt does not exist. Run a pack first.");
  process.exit(1);
}

const content = fs.readFileSync(tracePath, "utf-8");

// Extract calls and their tokens
const callMatches = [...content.matchAll(/Call #(\d+) \| Model: \[([^\]]+)\] \| Area: \[([^\]]+)\]/g)];
const tokenMatches = [...content.matchAll(/Tokens: Prompt: (\d+|not reported) \| Output: (\d+|not reported) \| Thoughts: (\d+) \| Call Total: (\d+)/g)];

console.log(`Found ${callMatches.length} model call(s) in trace.`);

let calculatedSum = 0;
for (let i = 0; i < tokenMatches.length; i++) {
  const callNum = callMatches[i] ? callMatches[i][1] : i + 1;
  const model = callMatches[i] ? callMatches[i][2] : "unknown";
  const area = callMatches[i] ? callMatches[i][3] : "unknown";
  const promptTok = tokenMatches[i][1];
  const outputTok = tokenMatches[i][2];
  const thoughtTok = parseInt(tokenMatches[i][3], 10);
  const callTotal = parseInt(tokenMatches[i][4], 10);

  console.log(`  Call #${callNum} [${model}] Area: [${area}] -> Prompt: ${promptTok}, Output: ${outputTok}, Thoughts: ${thoughtTok}, Call Total: ${callTotal}`);
  calculatedSum += callTotal;
}

// Extract reported total from summary
const totalMatch = content.match(/TOTAL TOKENS:\s*(\d+)/);
if (!totalMatch) {
  console.error("FAIL: TOTAL TOKENS line missing in trace summary.");
  process.exit(1);
}

const reportedTotal = parseInt(totalMatch[1], 10);
console.log(`Reported Total Tokens in Trace Summary: ${reportedTotal}`);
console.log(`Calculated Sum of Individual Calls    : ${calculatedSum}`);

assert.equal(calculatedSum, reportedTotal, `Token sum mismatch! Calculated ${calculatedSum} != Reported ${reportedTotal}`);
console.log("PASS: Trace token sum strictly matches reported total!");
