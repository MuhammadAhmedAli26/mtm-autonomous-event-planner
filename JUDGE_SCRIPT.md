# MIND TO MACHINE HACKATHON 2026 — JUDGES PRESENTATION SCRIPT
## Complete Walkthrough, Pitch & Q&A Defense Guide
**Target Event:** 4-Hour Physical Hackathon in Islamabad  
**Target Repository:** `https://github.com/MuhammadAhmedAli26/mtm-autonomous-event-planner`  
**Live UI:** `http://localhost:3000` (run via `node serve.mjs`)  
**CLI Command:** `node plan.mjs <file.txt>`

---

## 1. Quick Overview & Strategy (Pehle Yeh Samjhein)

Judges Hackathon me 100 points ka rubric follow karte hain:
- **Output Correctness (30 pts):** Plan 6 checks pass kare (Figures, Budget, Venue, Schedule, Judges, Areas).
- **Catching Wrong Message (20 pts):** Conflicting message reject ho aur trace me exact reason ho.
- **Understanding / Defense (20 pts):** Drawn team member confidently har part ka purpose explain kare.
- **Handling Change (10 pts):** Naye message par sirf affected areas update hon, $\le 5$ model calls, $< 1$ min.
- **UI / Presentation (10 pts):** Clean, clear visual dashboard (Plan, Trace, Rejected messages).
- **Predicting Change (5 pts):** Pre-written predictions on affected areas.
- **Token Efficiency (5 pts):** Room me sab se kam tokens (Lowest tokens + 100% valid plan).
- **Small Model Bonus (+10 pts):** `gemini-3.5-flash-lite` use kar ke bonus score karna.

---

## 2. The 30-Second Elevator Pitch (Start When Judge Arrives)

> **"Assalam-o-Alaikum Sir! We built the Autonomous Event Planner for the Mind to Machine 2026 Hackathon.**
> 
> Hamara core architectural philosophy hai: **'LLM Reads, Deterministic Code Solves'**.
> 
> Ham ne observe kiya ke jab LLMs ko math, time-slots aur budget arithmetic di jaye, to wo hallucinate karte hain ya token count 20,000+ chala jata hai. Is liye humne ek **Hybrid Agent Architecture** design kiya:
> 1. **Google Gemini (gemini-3.5-flash-lite)** sirf natural language reading aur typed semantic claims extraction karta hai (English aur Roman Urdu dono se).
> 2. **Pure Deterministic Code** exact arithmetic, constraint satisfaction, aur 5-area planning karta hai with **0% math drift** aur **lowest token consumption in the room (~2,900 tokens)**.
> 3. Jab koi naya message ya adversarial attack aata hai, humara **Transactional Update Gate** use pehle ledger clone par simulate karta hai. Agar koi invariant break ho (jaise food shortage ya budget cap blow), to message **instant reject** ho jata hai with exact reason, aur active plan 100% intact rehta hai!"

---

## 3. Architecture Deep-Dive (Why We Built Each Part)

Agar Judge pooche: *"Explain your architecture and what each file does"*, to yeh 6 stages explain karein:

### Stage 1: Multilingual Reader (`src/reader.mjs`)
- **Kaam:** Numbered text file ko read kar ke typed claims extract karta hai (`param`, `venue`, `food`, `judging`, `cost`, `rule`, `commit`, etc.).
- **Kyun banaya:** Messy text, WhatsApp messages, aur Roman Urdu ko clean structured data me convert karne ke liye.
- **Agar yeh na hota to:** Code raw string parsing me fail ho jata jab naye formats ya Roman Urdu slang aate.

### Stage 2: Provenance Ledger (`src/ledger.mjs`)
- **Kaam:** Har message aur claim ka audit trail maintain karta hai. **Newest-wins slot resolution** implement karta hai (e.g. 12 Nov caterer ka rate 20 Oct wale rate ko overwrite karta hai). Sath hi **Authority Standing Guard** check karta hai (participant ya vendor Dean ka budget cap ya student count change nahi kar sakta).
- **Kyun banaya:** Real world me purani offers supersede hoti hain aur unauthorized log rules change karne ki koshish karte hain.

### Stage 3: Deterministic Planner (`src/planner.mjs`)
- **Kaam:** 5 mandatory areas solve karta hai:
  - **Venue:** Headcount $150 \text{ students} + 10 \text{ staff} + 17 \text{ judges} = 177$ attendees ke liye cheapest hall select karta hai with generator feature (Hall A: 200 capacity, Rs 120,000).
  - **Food:** Exact 177 lunch boxes order karta hai at Rs 1,200/head (Rs 212,400, free delivery).
  - **Judging:** 50 teams / 3 teams max per judge = $\lceil 50 / 3 \rceil = 17$ judges assigned at Rs 5,000 honorarium (Rs 85,000).
  - **Budget:** Rs 120k + Rs 212.4k + Rs 85k + Rs 130k committed costs = **Rs 547,400** (Buffer: **Rs 102,600** within Rs 650,000 cap).
  - **Schedule:** 240-minute contiguous timeline with mandatory 15-min prayer break and 45-min parallel judging rounds.
- **Kyun banaya:** Zero token waste, sub-5ms execution, guaranteed mathematical correctness.

### Stage 4: Independent Invariant Verifier (`src/checks.mjs`)
- **Kaam:** Planner se completely decoupled hai (0 imports). 6 checks independent logic se re-verify karta hai: Figures, Budget, Venue, Schedule, Judges, Areas.
- **Kyun banaya:** To satisfy the strict rule of independent validation—planner khud ko grade nahi karta!

### Stage 5: Transactional Update Gate (`src/update.mjs`)
- **Kaam:** Incremental messages ko transactionally apply karta hai. Pehle trial ledger par simulate karta hai; agar budget exceed ho ya constraint break ho, to rejection reason log karta hai aur active plan preserve rehta hai.
- **Kyun banaya:** Hackathon judging me judges unseen deceptive messages inject karenge; system ko crash ya corrupt hone se bachana hai.

### Stage 6: Rule 3 Trace Engine (`src/trace.mjs`)
- **Kaam:** Har model call ka number, model name, area tag (`[READING]`), input, output, latency, aur prompt/completion tokens directly Gemini API ke `usageMetadata` se capture karta hai.
- **Kyun banaya:** Rubric me token honesty mandatory hai. Fake token counts disqualify kar dete hain.

---

## 4. Live 3-Minute Demo Walkthrough (What to Click & Show)

### Step 1: Show the Initial Plan Dashboard
- UI open karein: `http://localhost:3000`
- Top Header dikhayein:
  - `VALID` badge glowing green.
  - Model: `gemini-3.5-flash-lite` (Point out: Small model bonus!).
  - Total Tokens: `~2,900` tokens (Point out: Extremely low!).
  - Headcount formula: **150 Students + 10 Staff + 17 Judges = 177 Headcount**.
- 5 Cards briefly point out karein:
  - Venue: Hall A (200 seats, Rs 120,000).
  - Food: Standard lunch box (177 boxes, Rs 212,400).
  - Judging: 17 judges assigned for 50 teams (Rs 85,000).
  - Budget: Rs 547,400 allocated, Buffer Rs 102,600.
  - Schedule: 240 minutes, 12:30 PM prayer break (15 min mandatory).

### Step 2: Test Practice 1 — Valid Incremental Update (Acceptance)
- UI me left side par **"🟢 Practice 1: Printing +5k"** button par click karein.
- Explain karein:
  > *"Sir dekhein, Finance ne message bheja ke printing bill Rs 10k ke bajaye Rs 15k aya hai."*
- Click karte hi **Live Verdict Banner** glowing green ho jayega:
  - `✅ MESSAGE ACCEPTED`
  - Reason: `Plan updated successfully. Affected areas: [BUDGET]. Current budget: Rs 552,400 (Buffer: Rs 97,600).`
- Point out karein:
  > *"Dekhein Sir, system ne sirf 1 model call li, sirf BUDGET area ko touch kiya, Venue, Food aur Schedule intact rahe, aur response time under 1 second tha!"*

### Step 3: Test Practice 2 — Conflict Detection & Rejection
- UI me **"🔴 Practice 2: Caterer 100 Boxes"** button par click karein.
- Explain karein:
  > *"Ab Sir dekhein, Caterer message bhejta hai ke usne cost kam karne ke liye order 100 boxes kar diya hai. Lekin event me 177 logon ne khana khana hai!"*
- Click karte hi **Live Verdict Banner** glowing red alert ban jayega:
  - `🚫 CONFLICT DETECTED & REJECTED`
  - Reason: `food quantity 100 is below the people who must eat (150 students + 10 staff + 17 judges = 177). Active plan was preserved untouched.`
- Point out karein:
  > *"System ne foran detect kiya ke headcount invariant break ho raha hai. Isne message ko REJECT kiya aur active plan ko corrupt hone se bacha liya!"*

### Step 4: Test Adversarial 1 — 10x Price Typo
- UI me **"🔴 Adv 1: 10x Price Typo"** button click karein.
- Hall A rental surge price Rs 1,800,000 aati hai.
- System foran reject karta hai: `budget exceeded: Rs 2,167,400 > Rs 650,000 cap`.

### Step 5: Show Official Trace
- Scroll down to the bottom trace box.
- Point out:
  > *"Sir yeh official Rule 3 trace hai. Har call ka number, model name, area tag, prompt tokens, completion tokens exactly API se aa rahe hain. Math aur scheduling par 0 tokens spend hue hain."*

---

## 5. Token Optimization Secret (How We Got The Lowest Tokens)

Agar Judge pooche: *"How did you achieve such low token counts compared to other teams?"*

**Answer:**
1. **Single-Pass Reading:** Humne pooray pack ko single unified call me semantic claims me convert kiya instead of per-message separate calls.
2. **Deterministic Computation (Zero LLM Tokens for Math):** Other teams LLM ko bolti hain *"calculate the remaining budget"* ya *"write a schedule"*. Wo har step par 2,000-4,000 tokens zaya karte hain aur math galat hoti hai. Humne math, sorting, scheduling aur invariant checking pure JavaScript me likhi hai jisme 0 tokens lagte hain!
3. **Small Model Selection:** Humne `gemini-3.5-flash-lite` use kiya jo light, ultra-fast, aur organizers ki small-model bonus category me aata hai.

---

## 6. Judge Q&A Defense (10 Toughest Questions & Ready Answers)

### Q1: "Aap ne LLM se direct JSON plan kyun nahi generate karwaya?"
**Answer:**  
LLMs stochastic pattern-matchers hain, calculators nahi. Jab constraint heavy problem ho (177 headcount, capacity $\ge$ 177, budget cap $\le$ 650,000, 15 min per team for 50 teams with 3 teams max per judge), LLMs numeric drift karte hain aur hallucinations paida karte hain. Humara hybrid approach LLM ki linguistic strength aur deterministic code ki mathematical certainty ko combine karta hai.

### Q2: "Agar judges ek aisi constraint bhej dein jo sample pack me nahi thi, to system kaise handle karega?"
**Answer:**  
Humare Reader ke schema me generic rules support hain: `rule: { type: "min_order" | "window" | "surcharge" | "venue_feature" | "capacity_margin" }` plus generic `note` claims. Planner ke pass multi-factor constraint engine hai jo dynamic rules jaise tax percentage, lunch windows, aur minimum orders ko automatically handle karta hai.

### Q3: "Roman Urdu ko kaise handle kiya?"
**Answer:**  
Humare Reader prompt me Pakistani WhatsApp contexts aur Roman Urdu ke few-shot linguistic patterns integrated hain (e.g. *"ab Rs 1,200 per head hoga"*, *"delivery free hai"*, *"traffic on Srinagar Highway"*). Model semantics ko extract karta hai bina English translation ke loss ke.

### Q4: "Headcount 177 kaise banta hai?"
**Answer:**  
150 students + 10 staff + 17 judges = 177 attendees. Judges count calculate hota hai: 50 teams / 3 teams max per judge = $\lceil 16.66 \rceil = 17$ judges. Teeno groups event ke andar physical space occupy karte hain aur khana khate hain.

### Q5: "Checks file planner se decoupled kyun hai?"
**Answer:**  
`src/checks.mjs` me exactly zero imports hain. Agar planner ke andar koi bug ho, to checks file independent logic se data verify karti hai. A system should never verify its own assertions using shared logic.

### Q6: "Agar koi participant Dean ban kar budget cap barhane ka text bhej de?"
**Answer:**  
Ledger me **Authority Standing Guard** (`checkStanding`) laga hua hai. Har message ka sender role classify hota hai (`authority`, `supplier`, `judging`, `participant`). Sirf `authority` role budget cap ya core constraints modify kar sakta hai; participants aur suppliers ke unapproved claims drop ho jate hain.

### Q7: "Stale state ka kya scene hai agar judges fresh pack run karein?"
**Answer:**  
`plan.mjs` me Stale-State auto-detection hai: agar input me $\ge 5$ messages hon aur unka koi bhi hash purane state me match na ho, to system purana state archive kar ke automatic fresh run initiate karta hai without any manual flag.

### Q8: "New message evaluation me kitni model calls lagti hain?"
**Answer:**  
Exactly 1 model call (for reading and parsing the incoming message). Venue, schedule, food, judging aur budget calculations 0 model calls leti hain. Update 1 second se kam me complete ho jata hai, satisfying the $\le 5$ calls and $< 1$ min limit.

### Q9: "What would break if you removed `src/update.mjs`?"
**Answer:**  
Agar `update.mjs` na ho, to naya message direct ledger me chala jayega bina dry-run ke. Agar message conflicting ya adversarial ho (jaise caterer ka 100 boxes wala message), to active plan corrupt ho kar invalid state me chala jayega. `update.mjs` transaction rollback provide karta hai.

### Q10: "Can we see your clean clone and git history?"
**Answer:**  
Bilkul Sir! Repo GitHub par clean hai:
- Remote: `https://github.com/MuhammadAhmedAli26/mtm-autonomous-event-planner`
- Clean clone verified via native script in `< 10s` with zero npm installs!
- Commit history clean hai aur `.env` strictly gitignored hai.

---

## 7. Emergency Checklist Before Freeze (13:25 PKT)

- [x] Git status clean (`nothing to commit, working tree clean`)
- [x] All 14 unit & adversarial tests passing (`npm test` / `node tests/adversarial.test.mjs`)
- [x] UI server starts cleanly: `node serve.mjs` -> `http://localhost:3000`
- [x] Trace token sum strictly verified via `node tests/check_trace.mjs`
- [x] Tag `submission` pushed to GitHub
- [x] Laptop charged, internet hotspot ready!
