// Shared, provider-agnostic chat-completions client. Any OpenAI-compatible
// endpoint (OpenAI, DeepSeek, etc.) can be targeted by passing a different
// baseUrl/apiKey/model - this is what lets the same call site swap models
// like a plugin instead of hardcoding a single provider.

import { readFileSync } from "node:fs";
import path from "node:path";

export async function callChatCompletion({ baseUrl, apiKey, model, messages, maxTokens }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens
    })
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export function loadApiKey({ envVar, fallbackEnvVars = [] }) {
  for (const name of [envVar, ...fallbackEnvVars]) {
    if (process.env[name]) return process.env[name];
  }
  try {
    const envText = readFileSync(path.resolve(".env"), "utf8");
    for (const name of [envVar, ...fallbackEnvVars]) {
      const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
      if (match) return match[1].trim();
    }
  } catch {
    // fall through
  }
  throw new Error(`${[envVar, ...fallbackEnvVars].join(" or ")} not found in environment or .env`);
}

export function stripFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:javascript|js|json)?\r?\n([\s\S]*?)\r?\n```$/i);
  return fenced ? fenced[1] : trimmed;
}

export function costBreakdown(usage, priceTable) {
  if (!usage || !priceTable) return null;
  const cachedInputTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  const cacheWriteTokens = usage.prompt_tokens_details?.cache_write_tokens || 0;
  const plainInputTokens = usage.prompt_tokens - cachedInputTokens - cacheWriteTokens;
  const inputCost = (
    plainInputTokens * priceTable.input
    + cachedInputTokens * priceTable.cachedInput
    + cacheWriteTokens * priceTable.cacheWriteInput
  ) / 1_000_000;
  const outputCost = (usage.completion_tokens * priceTable.output) / 1_000_000;
  return { input_cost: inputCost, output_cost: outputCost, total_cost: inputCost + outputCost };
}

export function estimateCost(usage, priceTable) {
  return costBreakdown(usage, priceTable)?.total_cost ?? null;
}

// Maps OpenAI's usage shape to LangSmith's UsageMetadata shape so cost shows
// up in LangSmith's dashboards without needing a custom model-pricing rule.
export function langsmithUsage(usage) {
  if (!usage) return null;
  return {
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens
  };
}
