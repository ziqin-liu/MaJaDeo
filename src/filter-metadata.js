#!/usr/bin/env node

import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "selected_50.txt");

function usage() {
  console.error("Usage: npm run filter:metadata -- <input.jsonl> [output.jsonl]\n       npm run filter:metadata -- <input.jsonl> --in-place");
}

function codeNetId(value) {
  return String(value).match(/(?:codenet_)?(p\d+_\d+)/)?.[1] || null;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => ["-h", "--help"].includes(argument))) {
    usage();
    return;
  }

  const inPlace = arguments_.includes("--in-place");
  const positional = arguments_.filter((argument) => argument !== "--in-place");
  if (positional.length < 1 || positional.length > 2 || (inPlace && positional.length > 1)) {
    usage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(positional[0]);
  const outputPath = inPlace
    ? inputPath
    : path.resolve(positional[1] || inputPath.replace(/\.jsonl$/i, ".filtered.jsonl"));
  if (!inPlace && inputPath === outputPath) {
    throw new Error("Use --in-place to overwrite the input safely.");
  }

  const selectedIds = new Set(
    (await readFile(manifestPath, "utf8"))
      .split(/\r?\n/)
      .map(codeNetId)
      .filter(Boolean)
  );
  if (!selectedIds.size) throw new Error(`No CodeNet IDs found in ${manifestPath}`);

  const kept = [];
  const foundIds = new Set();
  let total = 0;
  for (const [index, line] of (await readFile(inputPath, "utf8")).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    total += 1;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }

    const identifier = codeNetId(record.filename ?? record.id ?? record.task_id ?? "");
    if (!identifier || !selectedIds.has(identifier)) continue;
    if (foundIds.has(identifier)) throw new Error(`Duplicate metadata record for ${identifier}`);
    foundIds.add(identifier);
    const { obfuscated: _obfuscated, ...filteredRecord } = record;
    kept.push(JSON.stringify(filteredRecord));
  }

  const missingIds = [...selectedIds].filter((identifier) => !foundIds.has(identifier));
  if (missingIds.length) {
    throw new Error(`Selection aborted; metadata is missing: ${missingIds.join(", ")}`);
  }

  const filteredContent = `${kept.join("\n")}\n`;
  if (inPlace) {
    const backupPath = `${inputPath}.bak`;
    const temporaryPath = `${inputPath}.tmp`;
    await copyFile(inputPath, backupPath);
    await writeFile(temporaryPath, filteredContent, "utf8");
    await rename(temporaryPath, inputPath);
    console.error(`Backup: ${backupPath}`);
  } else {
    await writeFile(outputPath, filteredContent, "utf8");
  }

  console.error(`Kept ${kept.length} of ${total} records in ${outputPath}`);
}

main().catch((error) => {
  console.error(`Metadata filtering failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
