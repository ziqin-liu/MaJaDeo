// Docker-sandboxed execution of untrusted JavaScript. This project's
// obfuscated-JS corpus is not guaranteed benign (evaluators/eval_code_with_docker.py
// has malware-analysis tooling for exactly this dataset), so anything that
// actually runs program code - unlike deobfuscate.js/deobfuscate-baseline.js,
// which only ever generate text - must go through here rather than a bare
// child_process call on the host.
//
// Each call gets its own throwaway container (--rm) with no network access
// and a hard timeout; nothing is shared across calls or test cases.

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_OUTPUT_BYTES = 1_000_000;

export async function runInSandbox(sourceCode, stdinInput, {
  timeoutMs = 10000,
  image = "node:18.19.0",
  memory = "256m",
  cpus = "1"
} = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "majadeo-sandbox-"));
  const containerName = `majadeo-sandbox-${randomUUID()}`;
  try {
    await writeFile(path.join(tempDir, "program.js"), sourceCode, "utf8");

    const args = [
      "run", "--rm", "-i",
      "--name", containerName,
      "--network", "none",
      "--memory", memory,
      "--cpus", cpus,
      "--pids-limit", "128",
      "-v", `${tempDir}:/sandbox:ro`,
      "-w", "/sandbox",
      image,
      "node", "/sandbox/program.js"
    ];

    return await runDockerProcess(args, stdinInput, timeoutMs, containerName);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runDockerProcess(args, stdinInput, timeoutMs, containerName) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let spawnError = null;

    const timer = setTimeout(() => {
      timedOut = true;
      // Killing this client process does NOT stop the container - `docker
      // run -i` just relays I/O, and the container keeps executing (and
      // burning CPU/never getting cleaned up by --rm) unless explicitly
      // killed by name.
      spawn("docker", ["kill", containerName]).on("error", () => {});
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      spawnError = error;
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (spawnError) {
        reject(spawnError);
        return;
      }
      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
        stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
        exitCode,
        timedOut
      });
    });

    child.stdin.on("error", () => {
      // Program may exit/crash before consuming stdin; that's a normal
      // program-side outcome, not a sandbox failure.
    });
    child.stdin.write(stdinInput ?? "");
    child.stdin.end();
  });
}
