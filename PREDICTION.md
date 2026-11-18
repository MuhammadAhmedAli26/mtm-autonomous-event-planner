# PREDICTION.MD — Area Prediction Slip Strategy

## The Prediction Rule for Test Run Step 4
When the organizers ask: *"Write down which areas will make model calls for the incoming message"*:

### Exact Answer to Write on the Slip:
**`reading` only (1 model call). All other areas (venue, schedule, food, judging, budget) are computed in deterministic code with 0 model calls.**

---

### Why this is 100% True by Design:
1. Under Architectural Decision D1 & D2, LLMs are used exclusively to parse natural language text into structured claims (tagged as `reading`).
2. Once claims are emitted, our TypeScript/JavaScript engine performs all arithmetic, constraint propagation, conflict checks, and timeline allocations in plain code.
3. Therefore, no matter which area the message impacts (e.g. food price increase, printing budget change, venue hall alteration), the model call is strictly:
   - **`reading` x 1**
   - **`venue`: 0**
   - **`schedule`: 0**
   - **`food`: 0**
   - **`judging`: 0**
   - **`budget`: 0**

### Verification in Terminal Trace:
After running `node plan.mjs <incoming-file>`, check the DECISIONS block in the trace:
```
[DECISION] Model calls this update: reading x1. Venue/schedule/food/judging/budget: code only.
```
And check the trace summary line:
```
MODEL CALLS: 1 | TOTAL TOKENS: ~900 | MODELS: gemini-3.5-flash-lite
```
Show this line directly to the judge or volunteer as proof.
