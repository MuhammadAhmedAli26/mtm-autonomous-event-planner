# MTM Hackathon Planner — Decisions Log

- D1: Model only reads; all arithmetic and constraints are executed in deterministic JavaScript code.
- D2: One batch reading call for initial pack; one reading call per incremental update; area tag is always `reading`.
- D3: Reader emits typed claims; code merges, supersedes newest-wins, and plans.
- D4: Rejection is based on mathematical and invariant validity checks, not LLM vibes.
- D5: Zero external npm dependencies; uses Node.js 20+ built-ins (`fetch`, `node:test`, `node:http`).
- D6: Single CLI entrypoint `node plan.mjs <file>` with automatic pack vs update mode detection.
- D7: Plain HTML/CSS/JS UI served via `node serve.mjs` on port 3000.
