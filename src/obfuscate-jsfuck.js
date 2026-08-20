#!/usr/bin/env node

import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import jsfuck from "jsfuck";

const { JSFuck } = jsfuck;
const REQUIRE_PRELUDE = "const require=process.mainModule.require.bind(process.mainModule);";

function usage() {
  console.error("Usage: npm run obfuscate:jsfuck -- <input-file-or-folder> [output-file-or-folder]");
}

function defaultFileOutputPath(inputPath) {
  const extension = path.extname(inputPath);
  const stem = path.basename(inputPath, extension);
  return path.join(path.dirname(inputPath), `${stem}.obf${extension || ".js"}`);
}

function isInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

function isJavaScriptFile(filePath) {
  return [".js", ".mjs", ".cjs"].includes(path.extname(filePath).toLowerCase());
}

function isGeneratedFile(filePath) {
  return /\.(?:obf|jsfuck)\.(?:js|mjs|cjs)$/i.test(filePath);
}

async function findJavaScriptFiles(directory, excludedDirectory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules"].includes(entry.name) || entryPath === excludedDirectory) continue;
      files.push(...await findJavaScriptFiles(entryPath, excludedDirectory));
    } else if (entry.isFile() && isJavaScriptFile(entryPath) && !isGeneratedFile(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function addNodeRequire(source) {
  const strictDirective = source.match(/^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use strict["'];?)/);
  if (strictDirective) {
    return `${strictDirective[1]}${REQUIRE_PRELUDE}${source.slice(strictDirective[1].length)}`;
  }
  return `${REQUIRE_PRELUDE}${source}`;
}

async function obfuscateFile(inputPath, outputPath) {
  const source = await readFile(inputPath, "utf8");
  new vm.Script(source, { filename: inputPath });

  const output = JSFuck.encode(addNodeRequire(source), true);
  if (!output || /[^\[\]()!+]/.test(output)) {
    throw new Error("Encoder produced invalid JSFuck output.");
  }
  new vm.Script(output, { filename: outputPath });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${output}\n`, "utf8");
  console.error(`Obfuscated ${inputPath} -> ${outputPath} (${source.length} -> ${output.length} characters)`);
}

async function main() {
  const [inputArgument, outputArgument, ...extraArguments] = process.argv.slice(2);
  if (!inputArgument || extraArguments.length > 0 || ["-h", "--help"].includes(inputArgument)) {
    usage();
    process.exitCode = inputArgument && ["-h", "--help"].includes(inputArgument) ? 0 : 1;
    return;
  }

  const inputPath = path.resolve(inputArgument);
  await access(inputPath);
  const inputStats = await stat(inputPath);
  if (!inputStats.isFile() && !inputStats.isDirectory()) {
    throw new Error(`Input is not a file or directory: ${inputPath}`);
  }

  if (inputStats.isFile()) {
    const outputPath = path.resolve(outputArgument || defaultFileOutputPath(inputPath));
    if (inputPath === outputPath) throw new Error("Input and output paths must be different.");
    await obfuscateFile(inputPath, outputPath);
    return;
  }

  const outputDirectory = path.resolve(outputArgument || path.join(inputPath, "jsfuck"));
  if (outputDirectory === inputPath || !isInside(inputPath, outputDirectory)) {
    throw new Error("Folder output must be a subdirectory of the input folder.");
  }

  const inputFiles = await findJavaScriptFiles(inputPath, outputDirectory);
  if (!inputFiles.length) {
    console.error(`No JavaScript files found in ${inputPath}`);
    return;
  }

  let failures = 0;
  for (const sourcePath of inputFiles) {
    const destinationPath = path.join(outputDirectory, path.relative(inputPath, sourcePath));
    try {
      await obfuscateFile(sourcePath, destinationPath);
    } catch (error) {
      failures += 1;
      console.error(`Failed ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.error(`Finished: ${inputFiles.length - failures} succeeded, ${failures} failed.`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`JSFuck obfuscation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
