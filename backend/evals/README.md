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

## RAG Retrieval Eval

RAG quality is evaluated separately from full dialogue generation:

```bash
.venv/bin/python -m backend.evals.run_rag_eval
```

This checks the expected source, document type, topic and key evidence, and also
reports Recall@K, MRR and authority-A hit rate. Medical-fact cases enable a hard
filter that excludes B/C evidence.

Current local smoke result:

- Cases: 7
- Passed: 7
- Pass rate: 1.0
- Recall@K: 1.0
- MRR: 1.0
- Authority-A hit rate: 1.0

The expanded retrieval matrix contains 100 queries across crisis routing,
de-escalation, medication boundaries, follow-up preparation, sleep/elevated
energy, mixed states, depression, relapse warning, impulsivity and work support:

```bash
.venv/bin/python -m backend.evals.build_rag_benchmark
.venv/bin/python -m backend.evals.run_rag_eval \
  --cases backend/evals/rag_benchmark_100.jsonl
```

Current result:

- Recall@5: 0.93
- MRR: 0.8933
- Authority-A hit rate for medical cases: 1.0
- Strict top-1 cases: 86/100

## Multi-turn Ablation

Build the 200-case multi-turn matrix:

```bash
.venv/bin/python -m backend.evals.build_multiturn_benchmark
```

Run deterministic full/no-RAG/no-longitudinal ablations without API usage:

```bash
OPENAI_API_KEY='' .venv/bin/python -m backend.evals.run_ablation_comparison --skip-generic
```

Run a stratified live comparison of BiPolaris against the same model with only
a generic assistant prompt:

```bash
.venv/bin/python -m backend.evals.run_ablation_comparison \
  --stride 4 --limit 50 --variants full --generic-limit 50 --concurrency 6
```

The 2026-07-24 live run produced:

- BiPolaris: 49/50 strict passes
- Generic model: 36/50 strict passes
- No human review and no LLM-as-judge were used

Export actual user inputs, replies and failure reasons:

```bash
.venv/bin/python -m backend.evals.analyze_ablation_badcases \
  backend/evals/results/ablation_latest.jsonl \
  --output backend/evals/results/ablation_badcases.md
```

The machine-readable baseline is tracked in
`backend/evals/baselines/stage4_2026-07-24.json`.

The rule benchmark and RAG smoke set are regression checks, not a claim of
overall conversational quality. Release decisions should additionally compare
real model outputs with a blinded human review set.

Badcase analysis now separates failures into assessment, strategy, retrieval,
longitudinal-state and output-guardrail layers:

```bash
.venv/bin/python -m backend.evals.analyze_badcases
```
