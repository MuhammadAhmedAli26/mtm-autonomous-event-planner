/**
 * Trace Logger for Mind to Machine Hackathon
 * Strictly adheres to Part 4 of the official build prompt.
 */

class TraceManager {
  constructor() {
    this.entries = [];
    this.decisions = [];
    this.callCounter = 0;
  }

  reset() {
    this.entries = [];
    this.decisions = [];
    this.callCounter = 0;
  }

  logCall({
    area,
    model,
    input,
    output,
    promptTokens = "not reported",
    completionTokens = "not reported",
    thoughtTokens = 0,
    totalTokens = 0,
    latency_ms = 0,
    status = "OK",
  }) {
    this.callCounter++;
    const entry = {
      n: this.callCounter,
      area,
      model,
      input,
      output,
      promptTokens,
      completionTokens,
      thoughtTokens,
      totalTokens,
      latency_ms,
      status,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  logDecision(text) {
    this.decisions.push({
      text,
      timestamp: new Date().toISOString(),
    });
  }

  getTotalTokens() {
    return this.entries.reduce((sum, e) => {
      const t = typeof e.totalTokens === "number" ? e.totalTokens : 0;
      return sum + t;
    }, 0);
  }

  getDistinctModels() {
    const set = new Set(this.entries.map((e) => e.model).filter(Boolean));
    return Array.from(set);
  }

  formatTraceText() {
    const lines = [];
    lines.push("================================================================================");
    lines.push("OFFICIAL EXECUTION TRACE (RULE 3)");
    lines.push("================================================================================");

    for (const e of this.entries) {
      lines.push(`Call #${e.n} | Model: [${e.model}] | Area: [${e.area.toUpperCase()}] | Status: ${e.status} (${e.latency_ms}ms)`);
      lines.push(`Input: ${e.input.length > 200 ? e.input.slice(0, 197) + "..." : e.input}`);
      lines.push(`Output: ${e.output.length > 300 ? e.output.slice(0, 297) + "..." : e.output}`);
      lines.push(`Tokens: Prompt: ${e.promptTokens} | Output: ${e.completionTokens} | Thoughts: ${e.thoughtTokens} | Call Total: ${e.totalTokens}`);
      lines.push("--------------------------------------------------------------------------------");
    }

    if (this.decisions.length > 0) {
      lines.push("");
      lines.push("--------------------------------------------------------------------------------");
      lines.push("DECISIONS (Deterministic Code & Constraint Verification)");
      lines.push("--------------------------------------------------------------------------------");
      for (const d of this.decisions) {
        lines.push(`[DECISION] ${d.text}`);
      }
      lines.push("--------------------------------------------------------------------------------");
    }

    const totalToks = this.getTotalTokens();
    const models = this.getDistinctModels().join(", ") || "none";
    lines.push("");
    lines.push(`MODEL CALLS: ${this.callCounter} | TOTAL TOKENS: ${totalToks} | MODELS: ${models}`);
    lines.push("================================================================================");

    return lines.join("\n");
  }
}

export const trace = new TraceManager();
