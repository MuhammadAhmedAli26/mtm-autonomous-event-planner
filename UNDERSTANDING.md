# UNDERSTANDING.MD — System Architecture & Defense Guide

## 1. Thirty-Second Elevator Pitch
"Our system is an autonomous, zero-dependency event planning agent. We use the Gemini 3.5 Flash-Lite model strictly as an intelligent reader to parse unstructured English and Roman Urdu messages into structured factual claims. Everything else — capacity fitting, schedule sequencing, judging round-robin assignments, and budget arithmetic — is computed deterministically in plain JavaScript code. This ensures 100% mathematical validity, zero hallucinations, lightning-fast execution (<2 seconds), and minimal token consumption."

---

## 2. Core Architectural Parts

### Part 1: Model Gateway & Execution Trace (`src/model.mjs`, `src/trace.mjs`)
- **What it is:** The strictly isolated boundary that interacts with external AI APIs and logs every single model invocation.
- **Why it exists:** Rule 3 of the hackathon mandates exact token reporting directly from model responses and area tagging.
- **What breaks without it:** Undisclosed model calls, estimated/falsified token counts, disqualification.
- **Example:** Call #1 logs `Prompt: 1119 | Output: 1951 | Total: 3070` tokens directly from `usageMetadata`.

### Part 2: The Reader (`src/reader.mjs`)
- **What it is:** Prompt-engineered parser translating noisy messages (emails, WhatsApp, notices) into typed claims.
- **Why it exists:** Handles natural language variation, date formats, and multilingual Roman Urdu without hardcoding.
- **What breaks without it:** System cannot extract numbers or recognize superseded pricing.
- **Example:** Translates `"Standard lunch box ab Rs 1,200 per head hoga"` into `{"k":"food", "item":"Standard lunch box", "unit_price":1200}`.

### Part 3: The Ledger (`src/ledger.mjs`)
- **What it is:** Factual state store resolving claims with provenance and newest-wins logic.
- **Why it exists:** Distinguishes between old offers and updated rates; rejects unauthorized claims.
- **What breaks without it:** Outdated prices winning over newer updates; participants arbitrarily raising the budget.
- **Example:** Supersedes 20 Oct caterer rate of Rs 1,000 with 12 Nov rate of Rs 1,200.

### Part 4: The Deterministic Planner (`src/planner.mjs`)
- **What it is:** Pure mathematical solver for Venue, Food, Judging, Budget, and Schedule.
- **Why it exists:** Eliminates AI hallucinations in arithmetic, capacity checks, and schedule overlap.
- **What breaks without it:** LLM arithmetic errors, double bookings, or budget overruns.
- **Example:** Computes headcount $150 + 10 + 17 = 177$, filters venues with capacity $\ge 177$, and picks lowest cost.

### Part 5: The Six Invariant Checks (`src/checks.mjs`)
- **What it is:** Independent verification engine verifying Figures, Budget, Venue, Schedule, Judges, and Areas.
- **Why it exists:** Guarantees that no plan is marked VALID unless all constraints pass.
- **What breaks without it:** Inability to detect invalid plans or mathematically justify rejections.
- **Example:** Independently recalculates $120,000 + 212,400 + 85,000 + 130,000 = 547,400 \le 650,000$.

### Part 6: The Update Gate (`src/update.mjs`)
- **What it is:** Transactional gate applying incremental messages onto a temporary copy of facts.
- **Why it exists:** Catches conflicts, protects plan validity, and logs exact rejection reasons.
- **What breaks without it:** Invalid messages corrupt the active plan.
- **Example:** Rejects caterer rounding order down to 100 boxes because 177 attendees must eat.

### Part 7: Unified Render & UI (`src/render.mjs`, `serve.mjs`, `ui/index.html`)
- **What it is:** Zero-dependency HTTP server and responsive dashboard showing Plan, Trace, and Messages.
- **Why it exists:** Satisfies UI requirement and allows judges to audit decisions and test live messages.
- **What breaks without it:** Judges cannot see live traces or test incremental messages.

---

## 3. Key Design Decisions

1. **Why the Model Only Reads:**
   Large Language Models excel at natural language understanding across English and Roman Urdu, but hallucinate arithmetic and constraint satisfaction. By confining the LLM to reading and running arithmetic in pure code, we guarantee 100% mathematical precision.
2. **Why One Batch Call:**
   Sending all messages in a single batch amortizes prompt overhead and costs only one reading call (~3,000 tokens) instead of 10 separate calls (~15,000 tokens).
3. **Why Validity-Based Rejection:**
   Vibe-based rejection fails on edge cases. We apply the claim transactionally to a ledger clone and re-run the 6 invariant checks. If any invariant fails, we reject with the exact mathematical violation.
4. **Why Zero Dependencies:**
   Built entirely on Node.js 20+ built-ins (`node:http`, `node:test`, `fetch`). A fresh clone installs in 0 seconds and never fails due to package version conflicts or network outages.

---

## 4. Honest Limits (What We Do Not Enforce)
- Subjective stylistic preferences (e.g. choice of background music).
- Unknown physical constraints not stated in messages (e.g. room temperature or chair color).
- External flight or traffic delays beyond logging them as operational availability notes.

---

## 5. Fifteen Likely Judge Questions & Two-Sentence Answers

1. **Q: Why did you pick Hall A instead of Hall B?**
   **A:** Hall A seats 200 attendees (headcount is 177) at Rs 120,000, which is Rs 30,000 cheaper than Hall B. Since no message in the pack mandated a standby generator as a hard constraint, Hall A is the optimal and cheapest valid choice.

2. **Q: How did you compute the headcount of 177?**
   **A:** 150 students plus 10 on-duty staff equals 160. Evaluating 50 teams at 3 teams per judge requires 17 judges ($\lceil 50/3 \rceil$), giving $150 + 10 + 17 = 177$ attendees who all require lunch boxes.

3. **Q: Why did you reject the caterer's message offering 100 boxes?**
   **A:** The event requires feeding 177 attendees, and reducing the order to 100 boxes violates the headcount coverage invariant. Our update gate caught this conflict and preserved the plan at 177 boxes.

4. **Q: Why is your token count so low?**
   **A:** We use the model strictly for reading in a single batch call. All arithmetic, venue selection, judging round-robin assignments, and budget calculations run in plain code at 0 tokens.

5. **Q: How does your system handle Roman Urdu?**
   **A:** Gemini 3.5 Flash-Lite has native multilingual comprehension for Urdu in Latin script. Our reader system prompt explicitly instructs it to interpret Roman Urdu phrases like "ab Rs 1,200 hoga" as pricing updates.

6. **Q: What happens if an unseen pack has 300 students?**
   **A:** The code dynamically computes 100 teams of 3, requires 34 judges, seats them in a hall with $\ge 354$ capacity, and scales the meal order accordingly or reports UNSAT if budget cap is exceeded.

7. **Q: Did you hardcode any facts from the sample pack?**
   **A:** Absolutely none. All participant counts, hall capacities, food rates, and committed costs are parsed dynamically from the input file at runtime.

8. **Q: Why do you have zero npm dependencies?**
   **A:** We use Node.js 20 built-ins (`node:test`, `node:http`, native `fetch`) to eliminate install delays, ensure instant startup on clean clones, and prevent supply-chain breakages.

9. **Q: How do you prevent participant messages from altering rules?**
   **A:** Our ledger implements standing checks. If a message from a "participant" attempts to alter hard parameters like budget_cap, headcount, or duration, it is rejected for lack of authority.

10. **Q: How do you prove your trace reports real tokens?**
    **A:** Every trace entry extracts `promptTokenCount` and `candidatesTokenCount` directly from the API's `usageMetadata` object and sums them with zero manual estimation.

11. **Q: What would you change with more time?**
    **A:** We would add an automated MILP (Mixed Integer Linear Programming) solver for complex multi-room parallel tracks and automated WhatsApp webhook receivers.

12. **Q: How does the system handle duplicate messages?**
    **A:** Every message text is hashed with SHA-256 upon arrival. If the hash already exists in state, it is immediately marked DUPLICATE without incurring model calls.

13. **Q: Why did Call #1 take 3,070 tokens?**
    **A:** It ingested all 8 messages at once, including headers and instructions, paying the instruction token cost once instead of repeating it across 8 individual calls.

14. **Q: How do you verify schedule validity?**
    **A:** Check 4 validates that every schedule block is contiguous, no blocks overlap, all mandatory breaks (like prayer) are present, and the total duration exactly matches the specified 240 minutes.

15. **Q: If internet goes down, can the system still work?**
    **A:** Yes, the architecture supports an `openai-compat` endpoint configured in `.env` (pointing to a local Ollama or LM Studio instance) with zero code modifications.
