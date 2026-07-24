from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CURATED_RAG_DOCS: list[dict[str, Any]] = [
    {
        "doc_id": "authority-nice-monitoring-001",
        "source": "NICE/CG185",
        "text": "NICE 双相障碍指南建议在评估中记录情绪、活动或去抑制行为的持续变化、既往触发因素和复发模式；长期管理也应持续监测情绪与用药。应用只能提示用户整理变化证据，不能据此自行诊断。",
        "retrieval_text": "NICE CG185 双相 评估 情绪 活动 去抑制 触发因素 复发模式 长期监测 睡眠 精力 冲动 个人基线 复诊",
        "metadata": {
            "dataset": "official-guidance",
            "doc_type": "official_guideline",
            "authority_level": "A",
            "evidence_type": "guideline",
            "source_title": "Bipolar disorder: assessment and management (CG185)",
            "source_url": "https://www.nice.org.uk/guidance/cg185/chapter/recommendations",
            "published_at": "2014-09-24",
            "reviewed_at": "2025-09-02",
            "risk_level": "low",
            "bd_state": "any",
            "topic": "followup_summary",
            "strategy": "Information + evidence-based longitudinal summary",
        },
    },
    {
        "doc_id": "authority-who-warning-signs-001",
        "source": "WHO/bipolar-disorder",
        "text": "WHO 患者教育资料列出的躁狂相关表现包括睡眠需求减少、思维或言语加快、注意力容易分散，以及冲动或冒险行为。单个表现不能用于确诊；持续变化或影响功能时应寻求专业评估。",
        "retrieval_text": "WHO 双相 躁狂 轻躁 睡眠需求减少 精力 思维加快 说话快 注意力分散 冲动 冒险 行为 专业评估",
        "metadata": {
            "dataset": "official-patient-education",
            "doc_type": "official_patient_education",
            "authority_level": "A",
            "evidence_type": "patient_education",
            "source_title": "Bipolar disorder",
            "source_url": "https://www.who.int/news-room/fact-sheets/detail/bipolar-disorder",
            "published_at": "2025-09-08",
            "reviewed_at": "2025-09-08",
            "risk_level": "low",
            "bd_state": "manic",
            "topic": "sleep",
            "strategy": "Information + uncertainty + encourage professional assessment",
        },
    },
    {
        "doc_id": "authority-nhs-medication-001",
        "source": "NHS/bipolar-disorder",
        "text": "NHS 患者信息明确提醒：即使感觉好转，也不要在没有医生指导时停止双相障碍药物。若出现副作用、漏服或希望调整治疗，应联系开药医生、精神科医生或药师讨论。",
        "retrieval_text": "NHS 双相 药物 停药 漏服 补服 副作用 调整剂量 医生 精神科 药师 不要自行停药 medication",
        "metadata": {
            "dataset": "official-patient-education",
            "doc_type": "official_patient_education",
            "authority_level": "A",
            "evidence_type": "patient_education",
            "source_title": "Bipolar disorder",
            "source_url": "https://www.nhs.uk/mental-health/conditions/bipolar-disorder/",
            "published_at": "",
            "reviewed_at": "2026-07-23",
            "risk_level": "low",
            "bd_state": "any",
            "topic": "medication_boundary",
            "strategy": "Information + medical boundary + contact prescriber",
        },
    },
    {
        "doc_id": "curated-safety-crisis-001",
        "source": "bipolaris/safety-protocol",
        "text": "当用户表达自杀、自残、药物过量、伤害他人或严重失控时，回复必须先共情，再给出希望24热线 400-161-9995、急救电话 120，并提醒联系紧急联系人。不要追问具体伤害方式、工具、地点或计划细节。",
        "retrieval_text": "危机 自杀 自残 轻生 不想活 活着没意义 结束这一切 药物过量 伤害别人 控制不住 希望24 400-161-9995 120 紧急联系人 crisis safety protocol",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "safety_rule",
            "risk_level": "crisis",
            "bd_state": "any",
            "topic": "crisis_intervention",
            "strategy": "Crisis override: validation + emergency resources + no method elaboration",
        },
    },
    {
        "doc_id": "curated-safety-medium-001",
        "source": "bipolaris/safety-protocol",
        "text": "当用户说自己快崩溃、受不了、控制不住、想砸东西或有冲动行为时，优先使用 medium-risk 降刺激策略：承认痛苦，建议暂停重大决定，远离刺激源，喝水、坐稳、慢呼吸，并联系可信任的人。",
        "retrieval_text": "崩溃 受不了 控制不住 失控 砸东西 冲动 花钱 吵架 冒险 降刺激 延迟决定 联系支持 medium risk de-escalation",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "safety_rule",
            "risk_level": "medium",
            "bd_state": "mixed",
            "topic": "de_escalation",
            "strategy": "Medium-risk de-escalation: validation + reduce stimulation + delay impulsive action + contact support",
        },
    },
    {
        "doc_id": "curated-bipolar-manic-001",
        "source": "bipolaris/bipolar-care",
        "text": "轻躁或躁狂线索包括睡眠需求减少但精力很高、想法加速、话多、冲动消费、冒险决定、易怒或停不下来。回复重点应是降速、减少刺激、保护睡眠、延迟重大决定，并建议联系现实支持者或医生。",
        "retrieval_text": "躁狂 轻躁 睡眠减少 精力高 不困 脑子快 话多 冲动消费 冒险 易怒 停不下来 保护睡眠 延迟重大决定 manic hypomanic",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "clinical_knowledge",
            "risk_level": "low",
            "bd_state": "manic",
            "topic": "manic_warning_signs",
            "strategy": "Reflection of feelings + Information + reduce stimulation + sleep protection",
        },
    },
    {
        "doc_id": "curated-bipolar-mixed-001",
        "source": "bipolaris/bipolar-care",
        "text": "混合状态可能同时有痛苦、低落、烦躁、精力上冲和冲动感。回复应高共情但克制，优先安全和稳定化，避免发散讨论，建议离开刺激源、暂停决定、让可信任的人陪伴。",
        "retrieval_text": "混合状态 既低落又烦躁 又累又停不下来 痛苦 冲动 烦躁 mixed episode 安全 稳定化 不发散",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "clinical_knowledge",
            "risk_level": "medium",
            "bd_state": "mixed",
            "topic": "mixed_state_support",
            "strategy": "Reflection of feelings + safety-oriented grounding + support contact",
        },
    },
    {
        "doc_id": "curated-bipolar-depressed-001",
        "source": "bipolaris/bipolar-care",
        "text": "抑郁状态下回复应先承认痛苦，避免打鸡血和说教。建议要足够小，例如喝水、吃一点东西、坐起来一分钟、给可信任的人发一句消息。不要要求用户立刻解决全部问题。",
        "retrieval_text": "抑郁 低落 没动力 疲惫 无望 自责 起不来 micro action 喝水 吃东西 坐起来 降低门槛 depressed support",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "support_strategy",
            "risk_level": "low",
            "bd_state": "depressed",
            "topic": "depressed_micro_action",
            "strategy": "Reflection of feelings + Affirmation and Reassurance + tiny-step suggestion",
        },
    },
    {
        "doc_id": "curated-medication-boundary-001",
        "source": "bipolaris/medical-boundary",
        "text": "涉及停药、加药、减药、补服、换药、副作用或药物与酒精相互作用时，不能给具体剂量或医疗决策。应建议记录症状和服药情况，并尽快咨询精神科医生或药师；紧急不适或过量服药时拨打 120。",
        "retrieval_text": "停药 加药 减药 补服 换药 副作用 药 酒 相互作用 剂量 医嘱 医生 药师 过量服药 120 medication boundary",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "medical_boundary",
            "risk_level": "medium",
            "bd_state": "any",
            "topic": "medication_boundary",
            "strategy": "Information + medical boundary + contact prescriber",
        },
    },
    {
        "doc_id": "curated-followup-summary-001",
        "source": "bipolaris/follow-up",
        "text": "复诊前摘要应关注近 7-30 天情绪波动、睡眠变化、精力和冲动程度、用药依从性、触发事件、危险信号和用户想问医生的问题。摘要应事实化，不做诊断。",
        "retrieval_text": "复诊 摘要 医生 情绪波动 睡眠 精力 冲动 用药 触发因素 预警信号 问医生 follow-up report",
        "metadata": {
            "dataset": "bipolaris-curated",
            "doc_type": "product_knowledge",
            "risk_level": "low",
            "bd_state": "stable",
            "topic": "followup_summary",
            "strategy": "Information + structured summary",
        },
    },
]


def load_mainland_authoritative_docs() -> list[dict[str, Any]]:
    path = Path(__file__).parent / "data" / "knowledge" / "mainland_authoritative.jsonl"
    if not path.exists():
        return []
    docs: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                docs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return docs


CURATED_RAG_DOCS.extend(load_mainland_authoritative_docs())
