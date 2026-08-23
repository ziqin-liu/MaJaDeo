// Shared LangSmith tracing helpers, used by both the standalone-LLM baseline
// (live tracing, one run per API call) and the harness-telemetry sync script
// (backfills existing Codex CLI run.json files as traces after the fact,
// since Codex CLI's own OpenAI calls aren't interceptable the same way).
//
// Tracing is best-effort: a LangSmith outage or misconfiguration must never
// break the actual deobfuscation pipeline, so every network call here is
// wrapped and failures are logged to stderr rather than thrown.

import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { RunTree } from "langsmith/run_trees";

// Nothing in this project loads .env automatically (no dotenv dependency),
// so LANGSMITH_* and other vars sitting in .env are otherwise invisible to
// process.env. Populate any missing ones once, on import, without
// overriding variables the shell environment already set.
(function loadDotEnvOnce() {
  try {
    const envText = readFileSync(path.resolve(".env"), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // No .env file; rely on whatever the shell environment already has.
  }
})();

export function isLangsmithEnabled() {
  return String(process.env.LANGSMITH_TRACING || "").toLowerCase() === "true"
    && Boolean(process.env.LANGSMITH_API_KEY);
}

export function getProjectName() {
  return process.env.LANGSMITH_PROJECT || "majadeo-deobfuscation";
}

// RunTree.postRun()/patchRun() only enqueue onto a background batch queue;
// resolving does not mean the write reached the server (this is exactly why
// the ±24h-old-timestamp rejection surfaces asynchronously, after the run
// that triggered it has already been reported "synced"). Without an
// explicit flush before the process exits, trailing writes from the end of
// a run can be silently dropped. Call this once, at the very end of any
// script that traces runs, before letting the process exit.
export async function flushLangsmith() {
  if (!isLangsmithEnabled()) return;
  await safely("flush", async () => {
    await RunTree.getSharedClient().awaitPendingTraceBatches();
  });
}

async function safely(label, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`  langsmith: ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Traces a single standalone-LLM completion call as one "llm"-type run.
export async function traceLlmRun({
  name,
  startTime,
  endTime,
  prompt,
  completion,
  usage,
  cost,
  model,
  status,
  error,
  metadata = {},
  tags = []
}) {
  if (!isLangsmithEnabled()) return null;

  let runId = null;
  await safely(`traceLlmRun(${name})`, async () => {
    const runTree = new RunTree({
      name,
      run_type: "llm",
      project_name: getProjectName(),
      start_time: startTime,
      inputs: { messages: [{ role: "user", content: prompt }] },
      metadata: { model, status, ...metadata },
      tags: [...tags, model, status].filter(Boolean)
    });
    await runTree.postRun();
    runId = runTree.id;
    await runTree.end(
      {
        completion,
        usage_metadata: usage ? { ...usage, ...(cost || {}) } : undefined
      },
      error || undefined,
      endTime
    );
    await runTree.patchRun();
  });
  return runId;
}

// Traces a full Codex CLI harness run (one file) as a root "chain" run with
// one "tool"/"llm" child per reasoning summary, tool call, and agent message
// recorded in that file's run.json telemetry.
export async function traceHarnessRun({
  name,
  startTime,
  endTime,
  prompt,
  status,
  error,
  usage,
  cost,
  model,
  reasoningSummaries = [],
  toolCalls = [],
  agentMessages = [],
  metadata = {},
  tags = []
}) {
  if (!isLangsmithEnabled()) return null;

  let rootId = null;
  await safely(`traceHarnessRun(${name})`, async () => {
    const root = new RunTree({
      name,
      run_type: "chain",
      project_name: getProjectName(),
      start_time: startTime,
      inputs: { messages: [{ role: "user", content: prompt }] },
      metadata: { model, status, ...metadata },
      tags: [...tags, model, status].filter(Boolean)
    });
    await root.postRun();
    rootId = root.id;

    for (const [index, text] of reasoningSummaries.entries()) {
      const child = root.createChild({
        name: `reasoning[${index}]`,
        run_type: "llm",
        start_time: startTime,
        inputs: {},
        metadata: { model }
      });
      await child.postRun();
      await child.end({ completion: text }, undefined, startTime);
      await child.patchRun();
    }

    for (const [index, item] of toolCalls.entries()) {
      const { type, ...rest } = item;
      const child = root.createChild({
        name: type || `tool_call[${index}]`,
        run_type: "tool",
        start_time: startTime,
        inputs: rest
      });
      await child.postRun();
      await child.end(rest, undefined, startTime);
      await child.patchRun();
    }

    for (const [index, text] of agentMessages.entries()) {
      const child = root.createChild({
        name: `agent_message[${index}]`,
        run_type: "llm",
        start_time: startTime,
        inputs: {},
        metadata: { model }
      });
      await child.postRun();
      await child.end({ completion: text }, undefined, startTime);
      await child.patchRun();
    }

    await root.end(
      {
        agentMessages,
        usage_metadata: usage ? { ...usage, ...(cost || {}) } : undefined
      },
      error || undefined,
      endTime
    );
    await root.patchRun();
  });
  return rootId;
}
