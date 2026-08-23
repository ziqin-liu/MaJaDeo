#!/usr/bin/env node
//
// Backfills run.json telemetry (from either src/deobfuscate.js, the Codex
// CLI harness, or src/deobfuscate-baseline.js, the standalone-LLM baseline)
// into LangSmith as traces, so both conditions' cost/tokens sit in the same
// LangSmith project. The baseline already gets *live* tracing as it runs
// (see src/deobfuscate-baseline.js); this script exists for (a) backfilling
// baseline runs made before live tracing existed, and (b) the harness
// condition, whose Codex CLI API calls aren't interceptable the way a
// direct fetch() call is — this reconstructs a trace per file after the
// fact from the telemetry MaJaDeo already records. Harness files get one
// root run (the whole Codex thread) with one child run per reasoning
// summary, tool call, and agent message; baseline files get a single "llm"
// run, matching how they're traced live.
//
// Incremental: records which run.json files have already been synced in a
// state file alongside them, so re-running only pushes new files.

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { flushLangsmith, isLangsmithEnabled, traceHarnessRun, traceLlmRun } from "./langsmith-telemetry.js";

const PRICE_PER_MILLION_TOKENS = {
  "gpt-5.6-terra": {
    input: 1,
    cachedInput: 0.1,
    cacheWriteInput: 1.25,
    output: 6
  }
};

function usage() {
  console.error("Usage: node src/sync-langsmith.js <telemetry-dir> [dataset-label]");
  console.error("  <telemetry-dir>: a .majadeo-runs or .majadeo-baseline-runs folder");
}

// Harness run.json (src/deobfuscate.js): usage.{input,cached_input,
// cache_write_input,output}_tokens are already-disjoint buckets.
function harnessCostBreakdown(model, usageObj) {
  const prices = PRICE_PER_MILLION_TOKENS[model];
  if (!usageObj || !prices) return null;
  const inputCost = (
    (usageObj.input_tokens || 0) * prices.input
    + (usageObj.cached_input_tokens || 0) * prices.cachedInput
    + (usageObj.cache_write_input_tokens || 0) * prices.cacheWriteInput
  ) / 1_000_000;
  const outputCost = ((usageObj.output_tokens || 0) * prices.output) / 1_000_000;
  return { input_cost: inputCost, output_cost: outputCost, total_cost: inputCost + outputCost };
}

function harnessLangsmithUsage(usageObj) {
  if (!usageObj) return null;
  const inputTokens = (usageObj.input_tokens || 0)
    + (usageObj.cached_input_tokens || 0)
    + (usageObj.cache_write_input_tokens || 0);
  const outputTokens = usageObj.output_tokens || 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    input_token_details: {
      cache_read: usageObj.cached_input_tokens || 0,
      cache_creation: usageObj.cache_write_input_tokens || 0
    },
    output_token_details: {
      reasoning: usageObj.reasoning_output_tokens || 0
    }
  };
}

// Baseline run.json (src/deobfuscate-baseline.js): raw OpenAI chat-completion
// usage shape, where prompt_tokens *includes* the cached/cache-write subsets.
function baselineCostBreakdown(model, usageObj) {
  const prices = PRICE_PER_MILLION_TOKENS[model];
  if (!usageObj || !prices) return null;
  const cachedInputTokens = usageObj.prompt_tokens_details?.cached_tokens || 0;
  const cacheWriteTokens = usageObj.prompt_tokens_details?.cache_write_tokens || 0;
  const plainInputTokens = usageObj.prompt_tokens - cachedInputTokens - cacheWriteTokens;
  const inputCost = (
    plainInputTokens * prices.input
    + cachedInputTokens * prices.cachedInput
    + cacheWriteTokens * prices.cacheWriteInput
  ) / 1_000_000;
  const outputCost = (usageObj.completion_tokens * prices.output) / 1_000_000;
  return { input_cost: inputCost, output_cost: outputCost, total_cost: inputCost + outputCost };
}

function baselineLangsmithUsage(usageObj) {
  if (!usageObj) return null;
  return {
    input_tokens: usageObj.prompt_tokens,
    output_tokens: usageObj.completion_tokens,
    total_tokens: usageObj.total_tokens,
    input_token_details: {
      cache_read: usageObj.prompt_tokens_details?.cached_tokens || 0,
      cache_creation: usageObj.prompt_tokens_details?.cache_write_tokens || 0
    },
    output_token_details: {
      reasoning: usageObj.completion_tokens_details?.reasoning_tokens || 0
    }
  };
}

// Harness reports carry threadId/reasoningSummaries; baseline reports carry
// finishReason and a flat prompt/completion-token usage object instead.
function isHarnessReport(report) {
  return report.threadId !== undefined || report.reasoningSummaries !== undefined;
}

async function loadSyncState(stateFilePath) {
  try {
    return new Set(JSON.parse(await readFile(stateFilePath, "utf8")));
  } catch {
    return new Set();
  }
}

async function saveSyncState(stateFilePath, syncedSet) {
  await writeFile(stateFilePath, `${JSON.stringify([...syncedSet].sort(), null, 2)}\n`, "utf8");
}

async function main() {
  const [telemetryDirArg, datasetLabelArg] = process.argv.slice(2);
  if (!telemetryDirArg || ["-h", "--help"].includes(telemetryDirArg)) {
    usage();
    process.exitCode = telemetryDirArg ? 0 : 1;
    return;
  }

  if (!isLangsmithEnabled()) {
    console.error("LangSmith tracing is disabled (set LANGSMITH_TRACING=true and LANGSMITH_API_KEY). Nothing to do.");
    return;
  }

  const telemetryDir = path.resolve(telemetryDirArg);
  const datasetLabel = datasetLabelArg || path.basename(path.dirname(path.dirname(telemetryDir)));
  const stateFilePath = path.join(telemetryDir, ".langsmith-synced.json");

  const entries = await readdir(telemetryDir, { withFileTypes: true });
  const runFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".run.json"))
    .map((entry) => entry.name)
    .sort();

  const synced = await loadSyncState(stateFilePath);
  const pending = runFiles.filter((name) => !synced.has(name));

  console.error(`Found ${runFiles.length} run.json file(s) in ${telemetryDir}; ${pending.length} not yet synced.`);

  let succeeded = 0;
  let failed = 0;
  for (const fileName of pending) {
    const report = JSON.parse(await readFile(path.join(telemetryDir, fileName), "utf8"));
    const originalStart = report.startedAt ? new Date(report.startedAt).getTime() : Date.now();
    const originalEnd = report.finishedAt ? new Date(report.finishedAt).getTime() : originalStart;

    // LangSmith's ingestion API rejects any run whose start_time is more
    // than ~24h old (a 422 from the background batch flush, which surfaces
    // asynchronously rather than as a thrown error here). Historical
    // run.json files are routinely days old, so backdating is not an
    // option: shift to "now" while preserving the original duration, and
    // keep the true timestamps in metadata for anyone querying later.
    const TWENTY_THREE_HOURS_MS = 23 * 60 * 60 * 1000;
    const isTooOld = Date.now() - originalStart > TWENTY_THREE_HOURS_MS;
    const endTime = isTooOld ? Date.now() : originalEnd;
    const startTime = isTooOld ? endTime - (originalEnd - originalStart) : originalStart;

    const harness = isHarnessReport(report);
    const commonMetadata = {
      condition: harness ? "harness" : "baseline",
      dataset: datasetLabel,
      filename: path.basename(report.inputPath || fileName),
      estimated_cost_usd: report.estimatedCostUsd,
      original_started_at: report.startedAt,
      original_finished_at: report.finishedAt,
      backfilled: isTooOld
    };

    const rootId = harness
      ? await traceHarnessRun({
        name: "harness-deobfuscate",
        startTime,
        endTime,
        prompt: report.prompt,
        status: report.status,
        error: report.error,
        usage: harnessLangsmithUsage(report.usage),
        cost: harnessCostBreakdown(report.model, report.usage),
        model: report.model,
        reasoningSummaries: report.reasoningSummaries || [],
        toolCalls: report.toolCalls || [],
        agentMessages: report.agentMessages || [],
        metadata: { ...commonMetadata, thread_id: report.threadId },
        tags: ["harness"]
      })
      : await traceLlmRun({
        name: "baseline-deobfuscate",
        startTime,
        endTime,
        prompt: report.prompt,
        completion: report.deobfuscated ?? null,
        usage: baselineLangsmithUsage(report.usage),
        cost: baselineCostBreakdown(report.model, report.usage),
        model: report.model,
        status: report.status,
        error: report.error,
        metadata: { ...commonMetadata, finish_reason: report.finishReason },
        tags: ["baseline"]
      });

    // Flushing per-file (rather than once at the end) trades some latency
    // for reliability: a single large queued batch of many runs has been
    // observed to silently vanish server-side with no client-visible error
    // at all (no thrown exception, no logged warning) — small per-file
    // batches do not exhibit this.
    await flushLangsmith();
    // Extra insurance alongside the per-file flush above: a short pause
    // between files, since queuing many small runs back-to-back is the one
    // pattern observed to silently drop writes server-side.
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (rootId) {
      synced.add(fileName);
      succeeded += 1;
      console.error(`  synced ${fileName} -> ${rootId}`);
    } else {
      failed += 1;
      console.error(`  failed ${fileName} (see langsmith error above)`);
    }
    await saveSyncState(stateFilePath, synced);
  }

  console.error(`Finished: ${succeeded} synced, ${failed} failed, ${runFiles.length - pending.length} already up to date.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
