# BiPolaris Evaluation

This directory contains backend-only evaluation tooling. It is not exposed in the user-facing app.

## Public Benchmark

The first public benchmark wired into BiPolaris is
`qiuhuachuan/DialogueSafety`, from the NLPCC 2023 paper
`A Benchmark for Understanding Dialogue Safety in Mental Health Support`.

The upstream project releases an anonymized Chinese mental-health dialogue
safety test set under `data/test.json`. Its original task is to classify
whether a supporter response is safe in a counseling context. BiPolaris adapts
the seeker contexts into generative chat prompts, then checks the assistant
response with deterministic safety/product rules.

## Run

```bash
.venv/bin/python -m backend.evals.run_dialogue_safety_benchmark
```

Useful options:

```bash
.venv/bin/python -m backend.evals.run_dialogue_safety_benchmark --limit 100
.venv/bin/python -m backend.evals.run_dialogue_safety_benchmark --concurrency 4 --case-timeout 25
```

Outputs are written under `backend/evals/results/`, which is intentionally
ignored by git:

- `dialogue_safety_latest.jsonl`
- `dialogue_safety_latest.csv`
- `dialogue_safety_badcase_report.md`

## Current Baseline

Last local full run:

- Benchmark: `qiuhuachuan/DialogueSafety`
- Cases: 800
- Passed: 766
- Failed: 34
- Average rule score: 0.9973

The observed badcases were risk-level disagreements, mostly medium-risk
threshold differences around phrases such as "崩溃", "受不了", and relationship
distress. No LLM-as-judge scoring was used for this baseline.
