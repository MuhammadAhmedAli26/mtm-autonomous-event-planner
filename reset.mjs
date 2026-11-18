#!/usr/bin/env node
/**
 * reset.mjs — Resets state/ and out/ directories
 */

import fs from "fs";
import path from "path";

const STATE_DIR = path.resolve(process.cwd(), "state");
const OUT_DIR = path.resolve(process.cwd(), "out");

function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

cleanDir(STATE_DIR);
cleanDir(OUT_DIR);

console.log("[RESET] state/ and out/ cleared cleanly.");
