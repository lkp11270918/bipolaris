# BiPolaris 双相情感障碍对话助手

这是一个基于 `bipolaris.docx` 内容制作的本地静态原型，用于演示双相情感障碍对话助手的核心交互。

## 运行方式

直接在浏览器打开 `index.html`。

如需使用真实后端对话模型链路，先启动 FastAPI：

```bash
cd /Users/liujindong/Documents/bipolaris
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export OPENAI_API_KEY="你的 OpenAI API Key"
export OPENAI_MODEL="gpt-4.1-mini"
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

然后刷新 `index.html`。前端会优先调用 `http://127.0.0.1:8000/chat`；如果后端未启动，会退回本地 fallback 回复。

## 真实数据集 + 本地 RAG

当前后端已经支持真实数据下载、清洗和本地向量检索。

1. 下载并清洗语料：

```bash
mkdir -p backend/data/raw
curl -L "https://huggingface.co/datasets/thu-coai/esconv/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet" -o backend/data/raw/esconv-train.parquet
curl -L "https://huggingface.co/datasets/Kanakmi/mental-disorders/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet" -o backend/data/raw/kanakmi-train.parquet
.venv/bin/python -m backend.scripts.prepare_rag_data
```

2. 建立本地向量索引：

```bash
.venv/bin/python -m backend.scripts.build_rag_index
```

3. 查看 RAG 状态：

```bash
curl http://127.0.0.1:8000/rag/status
```

当前默认会构建：

- `ESConv` 支持策略样例
- `Kanakmi/mental-disorders` 中 `label=1` 的 bipolar 叙事样例

本地索引文件位置：

- 语料：`backend/data/processed/corpus.jsonl`
- 向量库：`backend/data/rag.sqlite3`

当前默认业务参数：

- `RAG_TOP_K=4`：每次最多注入 4 条检索样例。
- `RAG_MIN_SCORE=0.32`：低于该相关度的样例不会进入 Context Payload。
- `MAX_ADVICE_ITEMS=3`：普通和中风险回复尽量不超过 3 个行动建议。
- `MAX_QUESTIONS_PER_REPLY=1`：每次最多一个追问，避免用户感到被盘问。
- `MAX_OUTPUT_TOKENS=850`：保留足够空间让安全提示完整收尾。

## 已实现能力

- 状态选择：平稳、偏躁、低落、混合。
- 自我状态速览：睡眠质量、精力水平、冲动程度。
- 状态感知回复：根据用户输入和当前状态给出不同的支持性回应。
- 危机优先机制：识别自伤、自杀、伤害他人、失控冲动等表达后，切换到危机响应。
- 危机资源：希望24热线 `400-161-9995`、急救电话 `120`、紧急联系人提醒。
- 稳定工具：生活锚点、早期预警信号、5-4-3-2-1 感官稳定练习。
- FastAPI 后端：`/chat`、`/safety-filter`、`/synthesize-context`。
- OpenAI 后端 LLM：普通对话通过隐藏 Context Payload + 系统 prompt 调用 OpenAI Responses API。
- 本地 RAG：整合 mood state、sleep、energy、impulsivity、medication schedule、warning signs、dialogue history，以及从真实 `ESConv` / `bipolar` 语料检索出的样例。

## 数据集处理状态

- `thu-coai/esconv`：已接入 train split，并清洗成支持策略检索语料。
- `Kanakmi/mental-disorders`：已接入 train split，并提取 `label=1` bipolar 叙事构建本地检索语料。
- `AIMH/SWMH`：Hugging Face 上存在但为 gated，需要 HF token 或访问授权后才能读取。

## 评测、LLM-as-Judge 与 badcase 分析

1. 运行手写产品验收 benchmark：

```bash
.venv/bin/python -m backend.evals.run_eval
```

2. 从公开数据集抽样生成评测集：

```bash
.venv/bin/python -m backend.evals.generate_public_cases --esconv-count 20 --bipolar-count 20
```

生成文件：

- `backend/evals/public_dataset_cases.jsonl`

3. 运行公开数据集评测：

```bash
.venv/bin/python -m backend.evals.run_eval --cases backend/evals/public_dataset_cases.jsonl --out-jsonl backend/evals/results/public_latest.jsonl --out-csv backend/evals/results/public_latest.csv
```

4. 启用 OpenAI LLM-as-Judge：

```bash
.venv/bin/python -m backend.evals.run_eval --judge
```

默认使用 `OPENAI_JUDGE_MODEL`；如果未设置，则使用 `OPENAI_MODEL`。

5. 生成 badcase 报告：

```bash
.venv/bin/python -m backend.evals.analyze_badcases --input backend/evals/results/latest.jsonl
```

生成文件：

- `backend/evals/results/badcase_report.md`

## 匿名反馈与日志

后端提供反馈接口：

- `POST /feedback`

当前本地日志位置：

- 交互指标：`backend/data/logs/interactions.jsonl`
- 用户反馈：`backend/data/logs/feedback.jsonl`

日志默认不保存用户原文，只记录风险等级、状态判断、策略、RAG 命中数量、消息长度等产品指标。正式上线前仍需要补充隐私政策、用户协议、数据删除机制和合规审查。

## 安全边界

这个原型不是医疗器械，也不能提供诊断或替代精神科治疗、心理咨询和急诊服务。正式产品需要加入专业审核、隐私合规、真实热线地区适配、危机升级流程和临床安全评估。
