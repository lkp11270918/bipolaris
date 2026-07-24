# BiPolaris 双相情感障碍对话助手

BiPolaris 是一个面向双相情感障碍日常支持场景的 state-aware AI 产品原型。它由 Next.js 前端与 FastAPI 后端组成，通过工程规则、LLM 语义分类、RAG、Few-shot Prompt 和输出安全护栏组合实现状态化支持。它不提供诊断，也不能替代精神科治疗、心理咨询或急诊服务。

## 运行方式

前端：

```bash
pnpm install
pnpm dev
```

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

在 `.env.local` 中设置 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`，然后打开 Next.js 提供的本地地址。后端或模型不可用时，产品会使用安全降级回复；高风险响应不依赖生成模型。

## AI 系统架构

```text
用户输入与状态记录
        ↓
Prompt Injection 预检
        ↓
工程风险规则 ── 命中明确风险 ──→ 分层危机响应
        ↓ 未命中
LLM 风险语义分类 ── 失败/低置信度 ──→ 保守兜底
        ↓
规则状态判断 + LLM 状态分类
        ↓
Unknown / Manic-Mixed 冲突处理
        ↓
3/7/30 天纵向状态模型（相对个人基线）
        ↓
结构化 TurnAssessment（风险、状态证据、用户需要、本轮主题）
        ↓
证据分级 RAG（A 权威 / B 支持策略 / C 语言理解）
        ↓
结构化 ResponsePlan（目标、策略、建议上限、必含/禁用项）
        ↓
System Prompt + 受约束的可信上下文
        ↓
LLM 回复生成 / 模型失败 fallback
        ↓
医疗越界、危机遗漏、Prompt 泄露后检查
        ↓
安全回复或拦截重写
```

风险等级分为：

- `low`：普通支持。
- `medium`：严重崩溃、失控或危险冲动；继续对话并降刺激。
- `high`：明确自伤/他伤意图；切换现实支持和热线引导。
- `imminent`：处于危险地点、持有工具或正在实施；直接使用紧急模板。

状态分类分为 `stable`、`depressed`、`manic`、`mixed`、`unknown`，输出置信度、证据、冲突标记和判断来源。

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
- WHO、NICE、NHS 的短篇权威知识条目（仅保存释义、来源和版本 metadata）
- 国家卫生健康委员会《精神障碍诊疗规范（2020年版）》双相障碍章节的 60 个可追溯语义 chunk

RAG 证据分级：

- `A`：官方指南或官方患者教育材料，可用于医疗事实。
- `B`：内部安全策略和情绪支持策略，只用于决定如何支持。
- `C`：ESConv 与患者叙事，只用于理解表达和对话风格，不能支撑医疗结论。
- 中国大陆首发时优先 `region=CN`；国际材料仅作为补充。面向临床人员且包含具体治疗方案的段落不会直接进入用户用药回答。

本地索引文件位置：

- 语料：`backend/data/processed/corpus.jsonl`
- 向量库：`backend/data/rag.sqlite3`

当前默认业务参数：

- `RAG_TOP_K=4`：每次最多注入 4 条检索样例。
- `RAG_MIN_SCORE=0.32`：低于该相关度的材料不会进入检索结果。
- `MAX_ADVICE_ITEMS=3`：普通和中风险回复尽量不超过 3 个行动建议。
- `MAX_QUESTIONS_PER_REPLY=1`：每次最多一个追问，避免用户感到被盘问。
- `MAX_OUTPUT_TOKENS=850`：保留足够空间让安全提示完整收尾。

## 已实现能力

- 状态选择：平稳、偏躁、低落、混合。
- 自我状态速览：睡眠质量、精力水平、冲动程度。
- 状态感知回复：根据用户输入和当前状态给出不同的支持性回应。
- 危机优先机制：识别自伤、自杀、伤害他人、失控冲动等表达后，切换到危机响应。
- 混合风险引擎：工程规则优先、LLM 语义分类、低置信度保守兜底。
- Few-shot：覆盖平稳、低落、偏躁、混合、证据不足和即时危险，并包含错误反例。
- 长上下文压缩：保留最近对话、较早主题摘要和独立安全事实。
- 结构化生成管线：先输出可审计判断和响应计划，再让模型生成自然语言。
- 纵向状态模型：按真实日期计算 3/7/30 天窗口，并保存可追溯的基线、差值和组合预警证据。
- 证据分级：医疗事实必须命中 A 级来源，患者叙事不会被当作医学知识。
- Prompt 防护：识别角色劫持与提示词索取，并拦截隐藏上下文泄露。
- 危机资源：希望24热线 `400-161-9995`、急救电话 `120`、紧急联系人提醒。
- 稳定工具：生活锚点、早期预警信号、5-4-3-2-1 感官稳定练习。
- FastAPI 后端：`/chat`、`/safety-filter`、`/synthesize-context`。
- OpenAI 后端 LLM：普通对话通过结构化判断、响应计划和受约束证据调用 OpenAI Responses API。
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

6. 构建并运行 50 条专项安全与状态评测：

```bash
.venv/bin/python -m backend.evals.build_specialized_benchmark
.venv/bin/python -m backend.evals.run_eval \
  --cases backend/evals/specialized_benchmark.jsonl \
  --out-jsonl backend/evals/results/specialized_latest.jsonl \
  --out-csv backend/evals/results/specialized_latest.csv
```

专项集覆盖即时危险、明确意图、中风险失控、Manic、Depressed、Mixed、Stable、用药越界和 Prompt Injection。当前确定性 fallback 基线为 50/50 通过；该结果仅表示产品规则验收通过，不代表临床有效性。

## 匿名反馈与日志

后端提供反馈接口：

- `POST /feedback`

当前本地日志位置：

- 交互指标：`backend/data/logs/interactions.jsonl`
- 用户反馈：`backend/data/logs/feedback.jsonl`

日志默认不保存用户原文，只记录风险等级、状态判断、策略、RAG 命中数量、消息长度等产品指标。正式上线前仍需要补充隐私政策、用户协议、数据删除机制和合规审查。

## 安全边界

这个原型不是医疗器械，也不能提供诊断或替代精神科治疗、心理咨询和急诊服务。正式产品需要加入专业审核、隐私合规、真实热线地区适配、危机升级流程和临床安全评估。
