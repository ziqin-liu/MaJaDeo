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

## Sandbox mode

Codex runs with `sandboxMode: "danger-full-access"` — the OS-level sandbox is
disabled and only the prompt instruction stops Codex from executing the input.
This was forced by a real failure: on this project's Windows dev machine,
Codex's native `workspace-write` sandbox refused every shell command before
it ran, so every turn failed without touching the file. Codex ships a
`codex-windows-sandbox-setup.exe` alongside the CLI binary
(`node_modules/@openai/codex-win32-x64/vendor/<target>/codex-resources/`)
that's apparently meant to provision the native sandbox; it isn't run
automatically by the SDK, and running it wasn't attempted here. If your setup
has a working `workspace-write` sandbox, restoring that sandbox mode in
`src/deobfuscate.js` is safer, since the process boundary is then enforced by
the OS rather than only by the prompt.

## Using a non-OpenAI model provider

Codex CLI can target any OpenAI-compatible endpoint via its `model_providers`
config. Set these environment variables to route through a third-party
provider (e.g. DeepSeek):

```sh
CODEX_MODEL_PROVIDER=deepseek
CODEX_MODEL_PROVIDER_BASE_URL=https://api.deepseek.com
CODEX_MODEL_PROVIDER_ENV_KEY=DEEPSEEK_API_KEY   # optional, defaults to "<PROVIDER>_API_KEY"
CODEX_MODEL_PROVIDER_WIRE_API=chat              # optional, defaults to "chat"
CODEX_MODEL=deepseek-chat
DEEPSEEK_API_KEY=...
```

The provider's API key must be in the environment variable named by
`CODEX_MODEL_PROVIDER_ENV_KEY` — Codex CLI reads it directly, not this
script. **This is unverified**: public sources disagree on whether the
installed Codex CLI version still accepts `wire_api = "chat"` (Chat
Completions) for third-party providers, or whether it now requires the
Responses API and a translation proxy (e.g. LiteLLM) in front of
Chat-Completions-only providers like DeepSeek. Test with a throwaway file and
check the run's `.run.json` log before trusting it for real work.
