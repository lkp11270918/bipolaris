# BiPolaris RAG Quality Design

Last updated: 2026-07-01

## Goal

BiPolaris RAG is used to ground replies in product safety rules, emotional
support strategies, bipolar lived-experience language, medication boundaries,
and follow-up summary guidance. It is not used as a medical knowledge base for
diagnosis or treatment decisions.

## Data Sources

- `bipolaris-curated`: hand-written product safety and clinical-boundary rules.
- `thu-coai/esconv`: emotional-support dialogue strategy examples.
- `Kanakmi/mental-disorders`: bipolar-labeled lived-experience narratives.

The curated source is intentionally prioritized for safety-critical situations
because it encodes product policy, hotline wording, medication boundaries, and
no-method-elaboration rules.

## Chunk Design

The ingestion script now uses source-aware chunking:

- Curated rules stay atomic.
- ESConv keeps a supporter turn plus recent dialogue window.
- Bipolar narratives use sentence-window chunks with overlap.

Compared with fixed character slicing, sentence windows reduce broken context
and make each retrieved item easier to use as evidence.

## Metadata

Each generated document includes metadata for retrieval and audit:

- `dataset`
- `doc_type`
- `risk_level`
- `bd_state`
- `topic`
- `intent`
- `evidence_quality`
- `parent_id`
- `chunk_index`
- `chunk_method`
- `chunk_size_chars`
- `strategy`

This metadata supports reranking, retrieval evaluation, and later badcase
analysis.

## Retrieval Strategy

The retriever now uses hybrid retrieval:

1. Vector search when embeddings are available.
2. Lexical search with Chinese/English query expansion.
3. Metadata-aware reranking.
4. Reciprocal-rank-style fusion across vector and lexical results.

Metadata reranking prioritizes:

- crisis safety rules for crisis queries
- medication-boundary documents for medication questions
- manic/mixed support documents for sleep, impulsivity, and agitation
- depressed micro-action support for low-energy depressive states
- follow-up summary guidance for doctor/report queries

If embeddings are unavailable, lexical retrieval still works from the processed
corpus and curated rules.

## Evaluation

RAG retrieval is evaluated separately from dialogue generation:

```bash
.venv/bin/python -m backend.evals.run_rag_eval
```

The eval checks whether top retrieval results match expected:

- source
- document type
- topic
- key evidence text

Current local result:

- Cases: 7
- Passed: 7
- Pass rate: 1.0

This is a small smoke suite, not a full benchmark. It should grow whenever a
new product safety rule, dataset slice, or badcase category is added.

## Rebuild Flow

After changing ingestion logic:

```bash
.venv/bin/python -m backend.scripts.prepare_rag_data
.venv/bin/python -m backend.scripts.build_rag_index
.venv/bin/python -m backend.evals.run_rag_eval
```

`build_rag_index` requires `OPENAI_API_KEY` because it creates embeddings.
