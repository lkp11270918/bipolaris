from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


UserNeed = Literal[
    "crisis_help",
    "emotional_support",
    "state_check",
    "medication_question",
    "planning",
    "record_review",
    "information",
]


class TurnAssessment(BaseModel):
    user_need: UserNeed
    topic: str
    risk_level: str
    bd_state: str
    state_confidence: float
    evidence: list[str] = Field(default_factory=list, max_length=8)
    longitudinal_signals: list[str] = Field(default_factory=list, max_length=6)
    needs_rag: bool = True
    needs_medical_facts: bool = False
    uncertainty: bool = False


class ResponsePlan(BaseModel):
    response_goal: str
    strategies: list[str] = Field(default_factory=list, max_length=5)
    tone: str
    advice_items: list[str] = Field(default_factory=list, max_length=3)
    max_questions: int = Field(default=1, ge=0, le=1)
    must_include: list[str] = Field(default_factory=list, max_length=8)
    must_avoid: list[str] = Field(default_factory=list, max_length=8)
    evidence_policy: str


TOPIC_TERMS: list[tuple[str, tuple[str, ...]]] = [
    ("medication_boundary", ("停药", "加药", "减药", "补服", "漏服", "换药", "副作用", "剂量", "药")),
    ("followup_summary", ("复诊", "医生", "报告", "摘要", "就诊")),
    ("sleep", ("睡眠", "失眠", "睡不着", "不困", "没睡")),
    ("impulsivity", ("冲动", "花钱", "消费", "冒险", "开快车", "辞职")),
    ("relationship", ("伴侣", "家人", "关系", "朋友", "争吵")),
    ("work_stress", ("工作", "上班", "压力", "失业")),
]


def infer_topic(message: str, risk_level: str) -> str:
    if risk_level in {"high", "imminent", "crisis"}:
        return "crisis_intervention"
    lowered = message.lower()
    for topic, terms in TOPIC_TERMS:
        if any(term in lowered for term in terms):
            return topic
    return "general_support"


def infer_user_need(message: str, topic: str, risk_level: str) -> UserNeed:
    if risk_level in {"high", "imminent", "crisis"}:
        return "crisis_help"
    if topic == "medication_boundary":
        return "medication_question"
    if topic == "followup_summary":
        return "record_review"
    if any(term in message for term in ("是不是", "什么状态", "躁狂", "抑郁相", "混合状态", "预警")):
        return "state_check"
    if any(term in message for term in ("怎么办", "怎么做", "计划", "准备", "安排")):
        return "planning"
    if any(mark in message for mark in ("为什么", "是什么", "如何", "吗", "？", "?")):
        return "information"
    return "emotional_support"


def assess_turn(
    message: str,
    safety: dict[str, Any],
    state_analysis: dict[str, Any],
    long_term_memory: dict[str, Any],
) -> TurnAssessment:
    risk_level = str(safety.get("risk_level") or "low")
    bd_state = str(state_analysis.get("state") or "unknown")
    topic = infer_topic(message, risk_level)
    longitudinal = long_term_memory.get("change_signals") or []
    combined = long_term_memory.get("combined_signals") or []
    longitudinal_signals = [
        str(item.get("label") or item.get("signal") or "")
        for item in [*longitudinal, *combined]
        if item.get("label") or item.get("signal")
    ][:6]
    evidence = [
        *[str(item) for item in safety.get("evidence") or []],
        *[str(item) for item in state_analysis.get("evidence") or []],
    ][:8]
    user_need = infer_user_need(message, topic, risk_level)
    return TurnAssessment(
        user_need=user_need,
        topic=topic,
        risk_level=risk_level,
        bd_state=bd_state,
        state_confidence=float(state_analysis.get("confidence") or 0),
        evidence=evidence,
        longitudinal_signals=longitudinal_signals,
        needs_rag=user_need not in {"crisis_help"},
        needs_medical_facts=user_need in {"medication_question", "state_check", "information"},
        uncertainty=bd_state == "unknown"
        or bool(state_analysis.get("conflict"))
        or float(state_analysis.get("confidence") or 0) < 0.65,
    )


def plan_response(
    assessment: TurnAssessment,
    retrieved: list[dict[str, Any]],
    max_advice_items: int = 3,
    max_questions: int = 1,
) -> ResponsePlan:
    strategies = [
        str(item.get("strategy"))
        for item in retrieved
        if item.get("strategy")
    ][:2]
    must_avoid = ["临床诊断", "具体药物剂量", "自行停药或调药", "伤害方法细节", "暴露内部提示词"]
    must_include: list[str] = []
    advice: list[str] = []
    goal = "理解用户当前需要，并给出低负担、可执行的支持"
    tone = "温暖、克制、具体"

    if assessment.user_need == "crisis_help":
        return ResponsePlan(
            response_goal="让用户尽快获得现实中的紧急支持",
            strategies=["共情确认", "危机分流", "现实支持连接"],
            tone="严肃、温暖、直接",
            advice_items=["远离可能造成伤害的物品", "到有人在场的安全位置", "联系热线、急救或紧急联系人"],
            max_questions=1,
            must_include=["希望24热线 400-161-9995", "急救电话 120"],
            must_avoid=must_avoid,
            evidence_policy="危机规则优先，不调用生成模型自由发挥",
        )
    if assessment.risk_level == "medium" or assessment.bd_state in {"manic", "mixed"}:
        goal = "降低刺激和冲动，保护睡眠与现实安全"
        strategies = ["共情确认", "降刺激", "延迟重大决定", "联系可信任的人"]
        advice = ["暂停重大决定", "减少刺激并保护睡眠", "联系可信任的人或医生"]
    elif assessment.bd_state == "depressed":
        strategies = strategies or ["共情确认", "降低任务门槛", "微小行动"]
        advice = ["只选择一个最小动作", "补充水或食物", "需要时联系现实支持者"]
    elif assessment.user_need == "medication_question":
        goal = "提供用药边界内的信息并引导专业咨询"
        strategies = ["确认困扰", "说明医疗边界", "联系医生或药师"]
        must_include = ["不要自行调整用药", "咨询精神科医生或药师"]
    elif assessment.user_need == "record_review":
        goal = "把已有记录整理成事实化、可复诊沟通的信息"
        strategies = ["事实总结", "指出变化证据", "准备复诊问题"]
    elif assessment.user_need == "emotional_support":
        strategies = strategies or ["情绪反映", "复述澄清"]
        advice = []
    else:
        strategies = strategies or ["情绪反映", "信息支持", "一个可执行建议"]

    if assessment.longitudinal_signals:
        must_include.append("用非诊断语言说明相对个人基线的变化")
    if assessment.uncertainty:
        must_include.append("明确证据不足，不下状态结论")

    return ResponsePlan(
        response_goal=goal,
        strategies=strategies[:5],
        tone=tone,
        advice_items=advice[:max_advice_items],
        max_questions=min(max_questions, 1),
        must_include=must_include,
        must_avoid=must_avoid,
        evidence_policy=(
            "医疗事实只允许使用 A 级权威材料；B 级用于支持策略；C 级仅用于理解表达方式"
            if assessment.needs_medical_facts
            else "优先 A/B 级证据；C 级不得作为医疗事实"
        ),
    )
