/**
 * Zero-dependency .env parser
 */
import fs from "fs";
import path from "path";

export function loadEnv(customPath) {
  const envPath = customPath || path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  const result = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }

  return result;
}
