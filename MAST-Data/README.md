---
license: cc-by-4.0
tags:
- code
- agents
- multi-agent-systems
- mast
- mad
- llm
pretty_name: 'MAD: Multi-Agent System Traces Dataset'
configs:
- config_name: default
  data_files:
  - split: train
    path: MAD_full_dataset.json
- config_name: human_labelled
  data_files:
  - split: train
    path: MAD_human_labelled_dataset.json
---

# MAD: Multi-Agent System Traces Dataset

Execution traces from multi-agent systems (MAS), annotated with the Multi-Agent Systems
Failure Taxonomy (MAST). Each record gives the MAS, the LLM behind it, the benchmark task,
the full trace, and binary annotations for the 14 MAST failure modes.

Code: https://github.com/multi-agent-systems-failure-taxonomy/MAST

1642 traces · 7 MAS frameworks · 8 benchmarks · 5 LLMs.

## Files

| file | rows | |
|---|---|---|
| `MAD_full_dataset.json` | 1642 | traces with MAST annotations |
| `MAD_human_labelled_dataset.json` | 19 | inter-annotator agreement study, 3 annotators |

## Schema

| field | type | |
|---|---|---|
| `mas_name` | string | AG2, MetaGPT, ChatDev, Magentic, AppWorld, HyperAgent, OpenManus |
| `llm_name` | string | GPT-4o, Claude, GPT-4o-mini, Qwen, CodeLlama |
| `benchmark_name` | string | ProgramDev, ProgramDev-v2, GSM, Olympiad, GAIA, MMLU, Test-C, SWE-Bench-Lite |
| `trace_id` | int | index within its config |
| `trace` | dict | `{key, index, trajectory}` |
| `mast_annotation` | dict | 14 codes → `1`, `0`, or `null` where the annotation is unavailable |

## Taxonomy

**Specification** — `1.1` Disobey Task Specification · `1.2` Disobey Role Specification ·
`1.3` Step Repetition · `1.4` Loss of Conversation History · `1.5` Unaware of Termination Conditions

**Inter-Agent Misalignment** — `2.1` Conversation Reset · `2.2` Fail to Ask for Clarification ·
`2.3` Task Derailment · `2.4` Information Withholding · `2.5` Ignored Other Agent's Input ·
`2.6` Reasoning-Action Mismatch

**Task Verification** — `3.1` Premature Termination · `3.2` No or Incomplete Verification ·
`3.3` Incorrect Verification

## Notes

Annotations are produced by an LLM judge, not by human labelling.

In `MAD_human_labelled_dataset.json`, each round uses a different revision of the taxonomy
(18, 17, 17 and 14 modes) and the codes are not comparable across rounds.

## Citation

```bibtex
@inproceedings{cemri2025mast,
  title     = {Why Do Multi-Agent LLM Systems Fail?},
  author    = {Cemri, Mert and Pan, Melissa Z. and Yang, Shuyi and Agrawal, Lakshya A. and Chopra, Bhavya and Tiwari, Rishabh and Keutzer, Kurt and Parameswaran, Aditya and Klein, Dan and Ramchandran, Kannan and Zaharia, Matei and Gonzalez, Joseph E. and Stoica, Ion},
  booktitle = {Advances in Neural Information Processing Systems},
  year      = {2025}
}
```
