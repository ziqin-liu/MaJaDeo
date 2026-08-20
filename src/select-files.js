#!/usr/bin/env node

import { access, copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "selected_50.txt");

function usage() {
  console.error("Usage: npm run select -- <source-folder> [output-folder]");
}

function codeNetId(filePath) {
  return path.basename(filePath).match(/(?:codenet_)?(p\d+_\d+)/)?.[1] || null;
}

function isInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (
    relativePath !== ".."
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath)
  );
}

async function findFiles(directory, excludedDirectory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entryPath === excludedDirectory || [".git", "node_modules"].includes(entry.name)) {
        continue;
      }
      files.push(...await findFiles(entryPath, excludedDirectory));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function main() {
  const [sourceArgument, outputArgument, ...extraArguments] = process.argv.slice(2);
  if (!sourceArgument || extraArguments.length > 0 || ["-h", "--help"].includes(sourceArgument)) {
    usage();
    process.exitCode = sourceArgument && ["-h", "--help"].includes(sourceArgument) ? 0 : 1;
    return;
  }

  const sourceDirectory = path.resolve(sourceArgument);
  const outputDirectory = path.resolve(outputArgument || path.join(sourceDirectory, "selected"));
  await access(sourceDirectory);
  if (!(await stat(sourceDirectory)).isDirectory()) {
    throw new Error(`Source is not a directory: ${sourceDirectory}`);
  }
  if (sourceDirectory === outputDirectory) {
    throw new Error("Source and output directories must be different.");
  }

  const manifestLines = (await readFile(manifestPath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const selectedIds = manifestLines.map(codeNetId);
  if (selectedIds.some((id) => !id) || new Set(selectedIds).size !== selectedIds.length) {
    throw new Error(`Invalid or duplicate CodeNet IDs in ${manifestPath}`);
  }

  const excludedDirectory = isInside(sourceDirectory, outputDirectory) ? outputDirectory : null;
  const candidates = await findFiles(sourceDirectory, excludedDirectory);
  const matches = new Map(selectedIds.map((id) => [id, []]));
  for (const candidate of candidates) {
    const id = codeNetId(candidate);
    if (id && matches.has(id)) {
      matches.get(id).push(candidate);
    }
  }

  const missing = selectedIds.filter((id) => matches.get(id).length === 0);
  const duplicates = selectedIds.filter((id) => matches.get(id).length > 1);
  if (missing.length || duplicates.length) {
    if (missing.length) console.error(`Missing IDs: ${missing.join(", ")}`);
    for (const id of duplicates) {
      console.error(`Duplicate ${id}: ${matches.get(id).join(", ")}`);
    }
    throw new Error("Selection aborted; every manifest ID must have exactly one match.");
  }

  await mkdir(outputDirectory, { recursive: true });
  for (const id of selectedIds) {
    const sourcePath = matches.get(id)[0];
    const destinationPath = path.join(outputDirectory, path.basename(sourcePath));
    await copyFile(sourcePath, destinationPath);
    console.error(`Copied ${sourcePath} -> ${destinationPath}`);
  }

  console.error(`Selected ${selectedIds.length} files into ${outputDirectory}`);
}

main().catch((error) => {
  console.error(`Selection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
