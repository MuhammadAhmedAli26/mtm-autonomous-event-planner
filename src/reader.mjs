/**
 * Reader Module
 * Turns raw messages into structured typed claims.
 * Strictly adheres to Part 5 of the official build prompt.
 */

import { callModel } from "./model.mjs";

const READER_SYSTEM_PROMPT = `You convert messages about planning one event into JSON. The input has numbered lines. Split it into messages (one email or text each; keep header lines with their body). Per message output id, lines, sender, date, role, status, why, claims using only the given claim kinds. Copy numbers exactly; normalize units (hours to minutes, lakh/k to digits); never do any other calculation. A message is relevant if it states a fact, offer, rule or commitment that could change the plan; irrelevant if it is chatter or personal logistics that cannot change the plan; request if it asks for something nobody has approved. Messages may be English, Urdu in Roman script, or mixed. If a message gives a newer value for something, still output the claim; the program resolves conflicts. If a constraint fits no kind, output a note claim. Output JSON only.

Allowed roles: "authority", "supplier", "judging", "participant", "other".
Allowed statuses: "relevant", "irrelevant", "request".

Allowed claim kinds:
- {"k":"param","name":"students|team_size|teams|duration_min|staff|budget_cap|start_time","value":number|"HH:MM"}
- {"k":"cost","label":"<noun>","amount":number}
- {"k":"venue","name":"<string>","capacity":number,"price":number,"features":["generator",...]}
- {"k":"food","item":"<string>","unit_price":number,"delivery":number}
- {"k":"judging","name":"available_judges|honorarium|minutes_per_team|max_teams_per_judge","value":number}
- {"k":"rule","type":"block","label":"<string>","minutes":number,"at":"HH:MM"|null,"window":["HH:MM","HH:MM"]|null}
- {"k":"rule","type":"venue_feature","feature":"<string>"}
- {"k":"rule","type":"capacity_margin","max_fill":number}
- {"k":"rule","type":"surcharge","applies_to":"venue|food|judging|all","pct":number|null,"flat":number|null}
- {"k":"rule","type":"headcount","who":"staff|judges|students","counted":boolean}
- {"k":"rule","type":"min_order","item":"<string>","qty":number}
- {"k":"commit","what":"food_qty|venue|judges","item":"<string>"|null,"name":"<string>"|null,"qty":number|null}
- {"k":"extra","label":"<string>","amount":number,"approved":boolean}
- {"k":"availability","who":"judge|staff","delay_min":number|null}
- {"k":"note","area":"venue|schedule|food|judging|budget","text":"<= 20 words"}`;

export async function readMessages(rawText, knownLabels = []) {
  const lines = rawText.split(/\r?\n/);
  const numberedLines = lines
    .map((line, idx) => `${idx + 1}: ${line}`)
    .join("\n");

  let userInput = `NUMBERED LINES:\n${numberedLines}`;
  if (knownLabels && knownLabels.length > 0) {
    userInput += `\n\nKNOWN LABELS: ${knownLabels.join(", ")}\nReuse a known label verbatim when the new message refers to the same thing.`;
  }

  const res = await callModel({
    area: "reading",
    system: READER_SYSTEM_PROMPT,
    user: userInput,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(res.text);
  } catch (err) {
    // Repair attempt if model output has minor formatting wrapper
    const match = res.text.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse Reader JSON output: ${res.text.slice(0, 150)}`);
    }
  }

  // Handle if the model returned an array of messages directly instead of {"messages": [...]}
  if (Array.isArray(parsed)) {
    parsed = { messages: parsed };
  }

  if (!parsed.messages || !Array.isArray(parsed.messages)) {
    console.error("[RAW MODEL OUTPUT]:", res.text.slice(0, 300));
    throw new Error("Reader JSON missing 'messages' array");
  }

  // Attach raw slice from original text using line ranges
  for (const m of parsed.messages) {
    if (m.lines && m.lines.length === 2) {
      const [start, end] = m.lines;
      m.rawText = lines.slice(start - 1, end).join("\n");
    } else {
      m.rawText = lines.join("\n");
    }
  }

  return parsed;
}
