# RUNBOOK_TESTRUN.MD — Live Test Run Checklist (13:30 PKT)

## Step 0: Volunteer Inspection (13:25 - 13:30)
1. Ensure you are in the project folder:
   ```powershell
   cd C:\mtm-agent
   ```
2. Verify git working directory is 100% clean:
   ```powershell
   git status
   ```
   *Expected Output: `nothing to commit, working tree clean`.*
3. Show the submitted commit hash:
   ```powershell
   git log -1 --oneline
   ```
   *Confirm this matches the hash submitted in the form.*

---

## Step 1: Initial Unseen Pack Run
1. When organizers share the link to the unseen pack, copy its exact text.
2. Save it inside the gitignored `packs/` directory:
   ```powershell
   notepad packs/unseen.txt
   ```
   *(Paste text, save, and close).*
3. Run the planner with the single command:
   ```powershell
   node plan.mjs packs/unseen.txt
   ```
4. Verify output prints:
   - 5-Area Plan
   - Invariant Verification: ALL 6 INVARIANT CHECKS PASSED
   - Official Trace with numbered calls and total tokens
   - Messages Audit Table

---

## Step 2: The Three Incremental Messages
As each message is released one at a time:

### Message 1:
1. Save text to `inbox/m1.txt`:
   ```powershell
   notepad inbox/m1.txt
   ```
2. Run update:
   ```powershell
   node plan.mjs inbox/m1.txt
   ```

### Prediction Slip (Before the announced message):
- Write on slip: **`reading` only (1 call)**.

### Message 2:
1. Save text to `inbox/m2.txt`:
   ```powershell
   notepad inbox/m2.txt
   ```
2. Run update:
   ```powershell
   node plan.mjs inbox/m2.txt
   ```

### Message 3:
1. Save text to `inbox/m3.txt`:
   ```powershell
   notepad inbox/m3.txt
   ```
2. Run update:
   ```powershell
   node plan.mjs inbox/m3.txt
   ```

---

## Step 3: Conflict Rejection Verification
- One of the three messages will be plausible but wrong.
- Confirm terminal trace prints:
  `[DECISION] REJECTED: <exact rule violation>`
- Confirm the 5-area plan remains valid and unchanged.

---

## Step 4: Final Upload
1. Copy the output report file:
   `out/final_report.txt`
2. Upload `final_report.txt` to the organizer submission form.
3. Keep the web UI open for judge visits:
   ```powershell
   node serve.mjs
   ```
   Open `http://localhost:3000` in browser.
