#!/usr/bin/env node

import { copyFile, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const JAVASCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

function usage() {
  console.error(
    "Usage: npm run add:metadata-field -- <input.jsonl> <files-folder> <field> [output.jsonl]\n"
    + "       npm run add:metadata-field -- <input.jsonl> <files-folder> <field> --in-place"
  );
}

function codeNetId(value) {
  return String(value).match(/(?:codenet_)?(p\d+_\d+)/)?.[1] || null;
}

async function findJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".majadeo-runs", "node_modules"].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findJavaScriptFiles(entryPath));
    } else if (entry.isFile() && JAVASCRIPT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => ["-h", "--help"].includes(argument))) {
    usage();
    return;
  }

  const inPlace = arguments_.includes("--in-place");
  const positional = arguments_.filter((argument) => argument !== "--in-place");
  if (positional.length < 3 || positional.length > 4 || (inPlace && positional.length > 3)) {
    usage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(positional[0]);
  const filesDirectory = path.resolve(positional[1]);
  const field = positional[2].trim();
  if (!field || ["__proto__", "constructor", "prototype"].includes(field)) {
    throw new Error(`Unsafe or empty field name: ${JSON.stringify(field)}`);
  }

  const outputPath = inPlace
    ? inputPath
    : path.resolve(positional[3] || inputPath.replace(/\.jsonl$/i, `.with-${field}.jsonl`));
  if (!inPlace && outputPath === inputPath) {
    throw new Error("Use --in-place to overwrite the input safely.");
  }

  const filesById = new Map();
  for (const filePath of await findJavaScriptFiles(filesDirectory)) {
    const identifier = codeNetId(filePath);
    if (!identifier) continue;
    if (filesById.has(identifier)) {
      throw new Error(`Duplicate files for ${identifier}: ${filesById.get(identifier)}, ${filePath}`);
    }
    filesById.set(identifier, filePath);
  }

  const updatedRecords = [];
  const usedIds = new Set();
  let totalRecords = 0;
  for (const [index, line] of (await readFile(inputPath, "utf8")).split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    totalRecords += 1;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
    }

    const identifier = codeNetId(record.filename ?? record.id ?? record.task_id ?? "");
    if (!identifier) throw new Error(`No CodeNet ID in metadata line ${index + 1}`);
    const filePath = filesById.get(identifier);
    if (!filePath) throw new Error(`No matching JavaScript file for ${identifier}`);
    if (usedIds.has(identifier)) throw new Error(`Duplicate metadata record for ${identifier}`);

    usedIds.add(identifier);
    record[field] = await readFile(filePath, "utf8");
    updatedRecords.push(JSON.stringify(record));
  }

  const unusedFiles = [...filesById.keys()].filter((identifier) => !usedIds.has(identifier));
  if (unusedFiles.length) {
    console.error(`Ignored ${unusedFiles.length} file(s) whose IDs are not present in the metadata.`);
  }

  const output = `${updatedRecords.join("\n")}\n`;
  if (inPlace) {
    const backupPath = `${inputPath}.bak`;
    const temporaryPath = `${inputPath}.tmp`;
    await copyFile(inputPath, backupPath);
    await writeFile(temporaryPath, output, "utf8");
    await rename(temporaryPath, inputPath);
    console.error(`Backup: ${backupPath}`);
  } else {
    await writeFile(outputPath, output, "utf8");
  }

  console.error(`Added field ${JSON.stringify(field)} to ${totalRecords} records in ${outputPath}`);
}

main().catch((error) => {
  console.error(`Metadata update failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
