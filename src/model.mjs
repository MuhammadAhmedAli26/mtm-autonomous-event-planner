/**
 * Central Model Gateway
 * The ONLY module that connects to external AI providers.
 * Strictly adheres to Part 4 of the official build prompt.
 */

import { trace } from "./trace.mjs";
import { loadEnv } from "./env.mjs";

loadEnv();

const VALID_AREAS = new Set(["reading", "venue", "schedule", "food", "judging", "budget"]);

export async function callModel({ area, system, user, schema }) {
  if (!VALID_AREAS.has(area)) {
    throw new Error(`Invalid area tag: "${area}". Must be one of: ${Array.from(VALID_AREAS).join(", ")}`);
  }

  const provider = (process.env.PROVIDER || "gemini").toLowerCase();
  const primaryModel = process.env.MODEL || "gemini-3.5-flash-lite";
  const fallbackModel = process.env.FALLBACK_MODEL || "gemini-flash-lite-latest";
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  const baseUrl = process.env.BASE_URL || "";

  const fullPromptInput = system ? `[SYSTEM]\n${system}\n\n[USER]\n${user}` : user;
  const timeoutMs = 45000;

  let attempts = 0;
  let lastError = null;

  while (attempts < 3) {
    attempts++;
    const currentModel = attempts <= 2 ? primaryModel : fallbackModel;
    if (attempts === 3) {
      console.warn(`[WARNING] Primary model failed twice. Switching to fallback: ${fallbackModel}`);
    }

    const t0 = Date.now();
    try {
      let rawOutput = "";
      let promptTokens = "not reported";
      let completionTokens = "not reported";
      let thoughtTokens = 0;
      let totalTokens = 0;
      let returnedModelName = currentModel;

      if (provider === "gemini") {
        const url = `${baseUrl || "https://generativelanguage.googleapis.com/v1beta"}/models/${currentModel}:generateContent`;
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const bodyPayload = {
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        };
        if (system) {
          bodyPayload.systemInstruction = { parts: [{ text: system }] };
        }
        if (schema) {
          bodyPayload.generationConfig.responseSchema = schema;
        }

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - t0;

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 160)}`);
        }

        const json = await res.json();
        returnedModelName = json.modelVersion || currentModel;
        rawOutput = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (json.usageMetadata) {
          const u = json.usageMetadata;
          promptTokens = typeof u.promptTokenCount === "number" ? u.promptTokenCount : "not reported";
          completionTokens = typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : "not reported";
          thoughtTokens = typeof u.thinkingTokenCount === "number" ? u.thinkingTokenCount : 0;
          totalTokens = typeof u.totalTokenCount === "number" ? u.totalTokenCount : ((typeof promptTokens === "number" ? promptTokens : 0) + (typeof completionTokens === "number" ? completionTokens : 0));
        }

        trace.logCall({
          area,
          model: returnedModelName,
          input: fullPromptInput,
          output: rawOutput,
          promptTokens,
          completionTokens,
          thoughtTokens,
          totalTokens,
          latency_ms: latencyMs,
          status: "OK",
        });

        return {
          text: rawOutput,
          model: returnedModelName,
          totalTokens,
          latencyMs,
        };
      } else if (provider === "openai-compat") {
        // OpenAI compatible (Ollama, LM Studio, etc.)
        const url = `${baseUrl || "http://localhost:11434"}/v1/chat/completions`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const messages = [];
        if (system) messages.push({ role: "system", content: system });
        messages.push({ role: "user", content: user });

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);
        const latencyMs = Date.now() - t0;

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 160)}`);
        }

        const json = await res.json();
        returnedModelName = json.model || currentModel;
        rawOutput = json.choices?.[0]?.message?.content || "";

        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? "not reported";
          completionTokens = json.usage.completion_tokens ?? "not reported";
          totalTokens = json.usage.total_tokens ?? 0;
        }

        trace.logCall({
          area,
          model: returnedModelName,
          input: fullPromptInput,
          output: rawOutput,
          promptTokens,
          completionTokens,
          thoughtTokens: 0,
          totalTokens,
          latency_ms: latencyMs,
          status: "OK",
        });

        return {
          text: rawOutput,
          model: returnedModelName,
          totalTokens,
          latencyMs,
        };
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (err) {
      console.warn(`[Attempt ${attempts} Failed with ${currentModel}]:`, err.message);
      const latencyMs = Date.now() - t0;
      lastError = err;
      trace.logCall({
        area,
        model: currentModel,
        input: fullPromptInput,
        output: `ERROR: ${err.message}`,
        promptTokens: "not reported",
        completionTokens: "not reported",
        thoughtTokens: 0,
        totalTokens: 0,
        latency_ms: latencyMs,
        status: "FAILED",
      });
    }
  }

  throw new Error(`All model attempts failed. Last error: ${lastError?.message}`);
}
