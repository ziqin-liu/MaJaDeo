# MaJaDeo

Deobfuscate JavaScript with a local Codex agent.

## Requirements

- Node.js 18 or newer
- Codex authentication, either from `codex login` or `OPENAI_API_KEY`

## Setup

```sh
npm install
```

## Usage

### Select the benchmark files

Use `selected_50.txt` to copy the selected CodeNet programs from any folder:

```sh
npm run select -- path/to/source-folder path/to/output-folder
```

If the output folder is omitted, files are copied to `<source-folder>/selected`.
The selector searches recursively and matches CodeNet IDs, so names such as
`codenet_p00048_1.js` and `codenet_p00048_1.obf.js` are both supported. It
aborts and reports details if an ID is missing or has multiple matches.

Filter CodeNet metadata with the same manifest:

```sh
npm run filter:metadata -- original-selected/Project_CodeNet_selected.jsonl
```

This writes `Project_CodeNet_selected.filtered.jsonl`, retaining the selected
records but removing their top-level `obfuscated` field. To replace the input
atomically while retaining a `.bak` backup:

```sh
npm run filter:metadata -- original-selected/Project_CodeNet_selected.jsonl --in-place
```

Add file contents to a field in each matching metadata record:

```sh
npm run add:metadata-field -- \
  original-selected/Project_CodeNet_selected.filtered.jsonl \
  path/to/obfuscated-folder \
  obfuscated
```

This recursively matches JavaScript files by CodeNet ID and writes a new JSONL
whose name ends with `.with-obfuscated.jsonl`. Supply an explicit output path as
the fourth argument, or use `--in-place` to replace the input while creating a
`.bak` backup. Missing or duplicate matches abort the update.

### Obfuscate with JSFuck

Obfuscate one JavaScript file:

```sh
npm run obfuscate:jsfuck -- path/to/input.js
```

This creates `path/to/input.obf.js`. To recursively obfuscate a folder:

```sh
npm run obfuscate:jsfuck -- path/to/input-folder
```

Folder results are written under `<input-folder>/jsfuck`, preserving the source
tree. An explicit output path may be supplied as the second argument. Output is
validated to contain only the six JSFuck characters: `[]()!+`.

The encoder adds a Node-compatible `require` binding before encoding because
JSFuck executes through the `Function` constructor. This allows standalone
CodeNet programs that use `require("fs")` to continue reading standard input.

### One file

```sh
npm run deobfuscate -- path/to/obfuscated.js
```

By default this creates `path/to/obfuscated.deobfuscated.js`. To choose the
destination explicitly:

```sh
npm run deobfuscate -- path/to/obfuscated.js path/to/clean.js
```

The destination must be in the input file's directory or one of its
subdirectories so Codex can write it without broader filesystem access.

### A whole folder

Pass a directory to recursively process all `.js`, `.mjs`, and `.cjs` files:

```sh
npm run deobfuscate -- path/to/obfuscated-folder
```

Results are written to `path/to/obfuscated-folder/deobfuscated/`, preserving
the original subdirectory structure. Choose another output subdirectory with:

```sh
npm run deobfuscate -- path/to/obfuscated-folder path/to/obfuscated-folder/clean
```

Folder mode skips `.git`, `node_modules`, its output directory, and files whose
names already contain `.deobfuscated`. Each source file gets a separate Codex
thread; processing continues if one file fails and reports a summary at the end.
If the expected output file already exists, that source is skipped so rerunning
the command does not spend another Codex call on completed work.

The input folder must contain exactly one source `.jsonl` file. After all files
have been processed, folder mode writes `<metadata-name>.deobfuscated.jsonl` in
the same folder. Each matching record receives the source text in `obfuscated`
and the generated text in `deobfuscated`. When a file fails, its `deobfuscated`
value is `null`. The source metadata file is not overwritten, and generated
`.deobfuscated.jsonl` files are ignored on later runs.

## Run telemetry

Each run records detailed JSON telemetry:

- Single file: `<output-file>.run.json`
- Folder: `<output-folder>/.majadeo-runs/<source-file>.run.json`
- Folder summary: `<output-folder>/.majadeo-runs/summary.json`

The logs include timestamps, duration, model, thread ID, token usage, estimated
cost, tool calls, file changes, commands and their output, web/MCP calls, agent
messages, SDK reasoning summaries, errors, and the raw timestamped event stream.
Set the model with `CODEX_MODEL`; the default is `gpt-5.6-terra`:

```sh
CODEX_MODEL=gpt-5.6-terra npm run deobfuscate -- path/to/folder
```

Cost is an estimate based on standard short-context API token prices and may not
match actual billing. Codex exposes reasoning summaries and reasoning-token
counts, not private chain-of-thought. Run logs can contain source-derived text
and command output, so treat them as potentially sensitive.

The input is treated as untrusted and is analyzed statically; the prompt tells
Codex not to execute it. Review and test the generated file before using it in
production.

## Evaluation

The evaluation is based on the JsDeObsBench

### Setup environment

```sh
export PYTHONPATH="${PYTHONPATH}:/Users/ZacharyKimLiu/Projects/MaJaDeo"

cd evaluators
```

(if dont have a venv, install uv, and init a vm, by command: uv venv)

```sh
source .venv/bin/activate
uv pip install fire, codebleu, jsonlines, tqdm
uv pip install tree-sitter-javascript==0.21
```
