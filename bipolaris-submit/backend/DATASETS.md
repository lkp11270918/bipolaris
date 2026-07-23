# Hugging Face Dataset Notes

These notes summarize the dataset inspection used by the backend prompt/context design.

## `thu-coai/esconv`

- Access: public through Hugging Face Dataset Viewer.
- Splits: `train`, `validation`, `test`.
- Size: 1,300 rows total.
- Shape: one `text` column. Each cell is a JSON string containing:
  - `emotion_type`
  - `problem_type`
  - `situation`
  - `dialog`
  - supporter `strategy` labels per system turn
- Useful strategies:
  - `Question`
  - `Reflection of feelings`
  - `Restatement or Paraphrasing`
  - `Providing Suggestions`
  - `Information`
  - `Affirmation and Reassurance`
  - `Self-disclosure`

Use in this project: general emotional-support strategy selection and response structure.

## `AIMH/SWMH`

- Access: dataset exists but is gated on Hugging Face.
- Dataset card summary: Reddit SuicideWatch and Mental Health Collection, including suicide-related intention and mental disorders such as depression, anxiety, and bipolar.
- Current project status: not ingested because gated datasets require Hugging Face access approval/token.

Use in this project after access: crisis-language retrieval examples, suicidal ideation wording, and bipolar-related community narratives.

## `Kanakmi/mental-disorders`

- Access: public through Hugging Face Dataset Viewer.
- Splits: `train`, `test`, `val`.
- Size: 581,217 rows total.
- Shape: `text`, `label`.
- Label mapping from dataset card:
  - `0`: BPD
  - `1`: bipolar
  - `2`: depression
  - `3`: Anxiety
  - `4`: schizophrenia
  - `5`: mentalillness

Use in this project: label `1` is treated as the bipolar-specific narrative source for prompt/RAG examples.

