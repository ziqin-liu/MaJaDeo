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

The input is treated as untrusted and is analyzed statically; the prompt tells
Codex not to execute it. Review and test the generated file before using it in
production.
