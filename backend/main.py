from __future__ import annotations

import json
import os
import re
import time
import uuid
from collections import Counter
from datetime import datetime
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .prompting import DATASET_NOTES, RETRIEVAL_SEEDS, SYSTEM_PROMPT
from .classification import classify_risk_semantically, classify_state_semantically
from .crypto import encrypt_text
from .decision_pipeline import TurnAssessment, assess_turn, plan_response
from .longitudinal import build_longitudinal_state
from .output_guardrails import apply_output_guardrail
from .persistence import (
    delete_user_data,
    get_user_settings,
    list_event_logs,
    list_mood_logs,
    save_event_log,
    save_mood_log,
    save_user_settings,
)
from .retriever import LocalRetriever
from .settings import (
    FEEDBACK_PATH,
    INTERACTION_LOG_PATH,
    MAX_ADVICE_ITEMS,
    MAX_OUTPUT_TOKENS,
    MAX_QUESTIONS_PER_REPLY,
    ADMIN_METRICS_TOKEN,
    OPENAI_MODEL,
    RAG_MAX_HISTORY,
    RAG_MIN_SCORE,
    RAG_TOP_K,
)
from .telemetry import append_jsonl

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - exercised when dependencies are missing.
    OpenAI = None  # type: ignore[assignment]


BDState = Literal["stable", "manic", "depressed", "mixed", "unknown"]
RiskLevel = Literal["low", "medium", "high", "imminent", "crisis"]


CRISIS_PATTERNS = [
    r"自杀|轻生|了结自己|结束这一切|不想活|活着没意义|死了算了|去死",
    r"自残|伤害自己|割腕|跳楼|撞车|吞药|过量服药|overdose",
    r"伤害别人|杀了|弄死|报复|控制不住.*(打|砸|伤|杀)",
    r"控制不住.*(伤害自己|自残|伤害别人|打人|杀|撞)",
    r"喝死|喝到死|吸毒|嗑药|滥用药",
]

IMMINENT_PATTERNS = [
    r"(现在|马上|立刻).{0,12}(跳|割|吞|撞|杀|自杀|轻生)",
    r"(楼顶|天台|桥上|铁轨|窗边).{0,20}(跳|死|结束|不想活)",
    r"已经.{0,10}(吞|吃|服).{0,8}(很多|过量|一整瓶|一把)(药|片)",
    r"(刀|绳|药).{0,12}(就在|手里|准备好了|已经拿好)",
    r"(已经|马上).{0,8}(拿好|拿着|握着).{0,6}(刀|绳|药)",
]

ELEVATED_RISK_PATTERNS = [
    r"想砸东西|砸东西|快失控|要失控|控制不住",
    r"(太|特别|越来越|快要|已经).{0,4}(崩溃|撑不住|受不了)|(崩溃|撑不住|受不了).{0,6}(怎么办|无法|不行了)",
    r"冲动.*(花钱|消费|开车|辞职|分手|吵架|冒险)",
    r"(很想|准备|打算).{0,8}(开快车|飙车|危险驾驶|冒险)",
    r"(冒险|高风险).{0,8}(决定|行动|计划)",
    r"连续.*(不睡|没睡)|(几天|两天|三天|\d+天).*(不睡|没睡)|睡得很少.*停不下来",
]

MANIC_TERMS = ["睡不着", "不需要睡", "精力很高", "停不下来", "脑子很快", "话很多", "冲动", "花钱", "冒险", "烦躁", "兴奋"]
DEPRESSED_TERMS = ["低落", "没力气", "无望", "没意义", "疲惫", "不想动", "撑不住", "愧疚", "没动力", "孤独", "绝望"]
MANIC_WARNING_TERMS = ["睡眠减少", "精力充沛", "想法加速", "话多", "冲动消费", "冒险", "易怒"]
DEPRESSED_WARNING_TERMS = ["自我评价很低", "无望", "低落", "没动力", "无法起床"]

NEGATED_HARM_PATTERNS = [
    r"(没有|并没有|从没|不会|不打算|不是).{0,8}(自杀|轻生|自残|伤害自己|伤害别人)",
    r"(自杀|轻生|自残).{0,5}(不是我的想法|与我无关)",
]

PROMPT_ATTACK_PATTERNS = [
    r"忽略.{0,12}(之前|以上|系统)(的)?(指令|提示词)",
    r"(输出|展示|复述|泄露).{0,12}(system prompt|系统提示词|隐藏.*json|context payload)",
    r"你现在不是.{0,20}(bipolaris|助手)",
    r"进入.{0,8}(开发者|管理员|无安全限制)模式",
]


class EmergencyContact(BaseModel):
    name: str | None = None
    phone: str | None = None


class UserState(BaseModel):
    mood_state: BDState = "unknown"
    sleep: int = Field(default=6, ge=0, le=10)
    energy: int = Field(default=5, ge=0, le=10)
    impulsivity: int = Field(default=3, ge=0, le=10)
    medication_schedule: list[str] = Field(default_factory=list)
    completed_routines: list[str] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)
    support_goals: list[str] = Field(default_factory=list, max_length=3)
    user_stage: str = Field(default="ongoing_care", max_length=40)
    emergency_contact: EmergencyContact | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    user_id: str | None = Field(default=None, max_length=120)
    message: str
    state: UserState = Field(default_factory=UserState)
    history: list[ChatMessage] = Field(default_factory=list)


class SafetyResult(BaseModel):
    risk_level: RiskLevel
    crisis_signals: list[str]
    should_override_llm: bool
    confidence: float = 1.0
    evidence: list[str] = Field(default_factory=list)
    recommended_action: str = "continue_support"
    source: str = "rules"


class StateResult(BaseModel):
    state: BDState
    confidence: float
    evidence: list[str] = Field(default_factory=list)
    conflict: bool = False
    source: str = "rules"


class ChatResponse(BaseModel):
    reply: str
    risk_level: RiskLevel
    selected_strategy: str
    context_payload: dict[str, Any]
    used_openai: bool
    assessment: dict[str, Any] = Field(default_factory=dict)
    response_plan: dict[str, Any] = Field(default_factory=dict)
    pipeline_version: str = "decision-strategy-response-v1"


class FeedbackRequest(BaseModel):
    case_id: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    label: Literal["helpful", "not_helpful", "not_understood", "unsafe", "medical_boundary", "too_generic", "not_actionable", "uncomfortable", "other"] = "other"
    comment: str | None = None
    risk_level: str | None = None
    bd_state: str | None = None
    selected_strategy: str | None = None
    user_message: str | None = Field(default=None, max_length=5000)
    assistant_reply: str | None = Field(default=None, max_length=8000)
    rag_sources: list[str] = Field(default_factory=list, max_length=10)
    used_openai: bool | None = None


class MoodLogRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=120)
    id: str = Field(min_length=3, max_length=120)
    created_at: str
    mood: int = Field(ge=0, le=5)
    sleep: int = Field(ge=0, le=5)
    energy: int = Field(ge=0, le=5)
    impulse: int = Field(ge=0, le=5)
    medication: Literal["taken", "missed", "partial", "none"]
    state: Literal["stable", "manic", "depressed", "mixed", "unknown"]
    notes: str = ""


class MoodLogResponse(MoodLogRequest):
    pass


class UserSettingsRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=120)
    display_name: str = Field(default="", max_length=80)
    age_range: str = Field(default="", max_length=40)
    diagnosis_status: str = Field(default="", max_length=80)
    support_goals: list[str] = Field(default_factory=lambda: ["warning_signs"], max_length=3)
    user_stage: str = Field(default="ongoing_care", max_length=40)
    emergency_contact_name: str = Field(default="", max_length=80)
    emergency_contact_phone: str = Field(default="", max_length=40)
    emergency_contact_relation: str = Field(default="", max_length=60)
    allow_emergency_contact_prompt: bool = True
    daily_checkin_enabled: bool = True
    daily_checkin_time: str = "08:30"
    medication_enabled: bool = False
    medication_time: str = "21:00"
    appointment_enabled: bool = True
    appointment_date: str = Field(default="", max_length=20)
    weekly_review_enabled: bool = True
    weekly_review_day: int = Field(default=0, ge=0, le=6)
    weekly_review_time: str = Field(default="19:30", max_length=8)
    long_term_memory_enabled: bool = True
    updated_at: str = ""


class UserSettingsResponse(UserSettingsRequest):
    pass


class DeleteUserDataRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=120)


class EventLogRequest(BaseModel):
    id: str | None = Field(default=None, max_length=120)
    user_id: str = Field(min_length=3, max_length=120)
    session_id: str = Field(default="", max_length=120)
    event_name: str = Field(min_length=2, max_length=80)
    event_time: str = ""
    properties: dict[str, Any] = Field(default_factory=dict)
    app_version: str = "0.1.0"
    platform: str = "web"


class EventLogResponse(BaseModel):
    status: str
    id: str


class AdminMetricsResponse(BaseModel):
    window_days: int
    total_events: int
    active_users: int
    active_sessions: int
    funnel: dict[str, Any]
    engagement: dict[str, Any]
    safety: dict[str, Any]
    model_quality: dict[str, Any]
    settings: dict[str, Any]
    raw_event_counts: dict[str, int]


app = FastAPI(title="BiPolaris Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

retriever = LocalRetriever(api_key=os.getenv("OPENAI_API_KEY"))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def normalized_confidence(value: Any, default: float = 0.5) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def safety_filter(
    message: str, history: list[ChatMessage] | None = None, semantic_enabled: bool = True
) -> SafetyResult:
    normalized = normalize_text(message)
    negated_harm = any(re.search(p, normalized, flags=re.IGNORECASE) for p in NEGATED_HARM_PATTERNS)
    imminent = [] if negated_harm else [
        p for p in IMMINENT_PATTERNS if re.search(p, normalized, flags=re.IGNORECASE)
    ]
    if imminent:
        return SafetyResult(risk_level="imminent", crisis_signals=imminent,
            should_override_llm=True, confidence=0.99, evidence=imminent,
            recommended_action="activate_crisis", source="rules")
    signals: list[str] = []
    for pattern in CRISIS_PATTERNS:
        if not negated_harm and re.search(pattern, normalized, flags=re.IGNORECASE):
            signals.append(pattern)
    if signals:
        return SafetyResult(
            risk_level="high",
            crisis_signals=signals,
            should_override_llm=True,
            evidence=signals,
            recommended_action="activate_crisis",
        )

    elevated_signals: list[str] = []
    for pattern in ELEVATED_RISK_PATTERNS:
        if re.search(pattern, normalized, flags=re.IGNORECASE):
            elevated_signals.append(pattern)
    if elevated_signals:
        return SafetyResult(risk_level="medium", crisis_signals=elevated_signals,
            should_override_llm=False, confidence=0.9, evidence=elevated_signals,
            recommended_action="check_safety")

    semantic = classify_risk_semantically(
        message, [item.model_dump() for item in (history or [])]
    ) if semantic_enabled else None
    if semantic:
        level = str(semantic.get("level", "low"))
        if level not in {"low", "medium", "high", "imminent"}:
            level = "medium"
        confidence = normalized_confidence(semantic.get("confidence"))
        # Low-confidence ambiguity is conservatively raised to medium, never silently lowered.
        if confidence < 0.65 and level == "low":
            level = "medium"
        return SafetyResult(
            risk_level=level, crisis_signals=[], should_override_llm=level in {"high", "imminent"},
            confidence=confidence, evidence=[str(x) for x in semantic.get("evidence", [])][:3],
            recommended_action=str(semantic.get("action", "check_safety")), source="llm",
        )
    return SafetyResult(risk_level="low", crisis_signals=[], should_override_llm=False,
        confidence=0.7, evidence=[], recommended_action="continue_support", source="fallback")


def infer_bd_state(message: str, state: UserState, history: list[ChatMessage] | None = None) -> StateResult:
    normalized = normalize_text(message)
    warning_text = " ".join(state.warning_signs)
    manic_score = sum(1 for term in MANIC_TERMS if term in normalized)
    manic_score += sum(1 for term in MANIC_WARNING_TERMS if term in warning_text)
    manic_score += 2 if state.mood_state == "manic" else 0
    manic_score += 2 if state.sleep <= 3 and state.energy >= 7 else 0
    manic_score += 1 if state.impulsivity >= 7 else 0

    depressed_score = sum(1 for term in DEPRESSED_TERMS if term in normalized)
    depressed_score += sum(1 for term in DEPRESSED_WARNING_TERMS if term in warning_text)
    depressed_score += 2 if state.mood_state == "depressed" else 0
    depressed_score += 1 if state.energy <= 3 else 0
    depressed_score += 1 if state.sleep <= 4 and state.energy <= 4 else 0

    if state.mood_state == "mixed" or (manic_score >= 2 and depressed_score >= 2):
        return StateResult(state="mixed", confidence=0.92, evidence=["elevated_and_depressed_signals"], conflict=False)
    if manic_score >= 2:
        return StateResult(state="manic", confidence=min(0.95, 0.65 + manic_score * 0.07), evidence=["elevated_signals"])
    if depressed_score >= 2:
        return StateResult(state="depressed", confidence=min(0.95, 0.65 + depressed_score * 0.07), evidence=["depressive_signals"])
    if state.mood_state == "stable" and 4 <= state.energy <= 6 and state.impulsivity <= 4 and state.sleep >= 5:
        return StateResult(state="stable", confidence=0.78, evidence=["stable_self_report_and_metrics"])

    semantic = classify_state_semantically(message, state.model_dump(), [x.model_dump() for x in (history or [])])
    if semantic:
        label = str(semantic.get("state", "unknown"))
        if label not in {"stable", "manic", "depressed", "mixed", "unknown"}:
            label = "unknown"
        confidence = normalized_confidence(semantic.get("confidence"))
        conflict = bool(semantic.get("conflict", False))
        if confidence < 0.65 or conflict:
            label = "unknown" if label == "stable" else ("mixed" if label in {"manic", "depressed"} and conflict else label)
        return StateResult(state=label, confidence=confidence,
            evidence=[str(x) for x in semantic.get("evidence", [])][:3], conflict=conflict, source="llm")
    return StateResult(state="unknown", confidence=0.45, evidence=["insufficient_evidence"], source="fallback")


def retrieve_examples(
    message: str,
    inferred_state: BDState,
    assessment: TurnAssessment | None = None,
) -> list[dict[str, Any]]:
    # Retrieval only needs a cheap routing hint; full semantic safety analysis happens once upstream.
    safety = safety_filter(message, [], semantic_enabled=False)
    rag_results = retriever.search(
        message,
        top_k=RAG_TOP_K,
        min_score=RAG_MIN_SCORE,
        bd_state=inferred_state,
        risk_level=safety.risk_level,
        topic=assessment.topic if assessment else None,
        medical_fact_required=assessment.needs_medical_facts if assessment else False,
    )
    if rag_results:
        return rag_results

    normalized = normalize_text(message)
    scored: list[tuple[int, dict[str, Any]]] = []
    for seed in RETRIEVAL_SEEDS:
        score = sum(1 for term in seed["match_terms"] if term.lower() in normalized)
        if inferred_state in {"manic", "mixed"} and "bipolar" in seed["source"]:
            score += 1
        if score:
            scored.append((score, seed))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [seed for _, seed in scored[:3]]


def select_strategy(
    message: str, inferred_state: BDState, safety: SafetyResult, retrieved_examples: list[dict[str, Any]]
) -> str:
    if safety.risk_level in {"high", "imminent", "crisis"}:
        return "Crisis override: validation + emergency resources + no method elaboration"
    if safety.risk_level == "medium":
        return "Medium-risk de-escalation: validation + reduce stimulation + delay impulsive action + contact support"
    rag_strategy = retriever.infer_strategy(retrieved_examples)
    if rag_strategy:
        return rag_strategy
    if inferred_state == "manic":
        return "Reflection of feelings + Information + Providing Suggestions"
    if inferred_state == "depressed":
        return "Reflection of feelings + Affirmation and Reassurance + tiny-step suggestion"
    if inferred_state == "mixed":
        return "Reflection of feelings + safety-oriented grounding + support contact"
    if any(term in normalize_text(message) for term in ["?", "吗", "怎么办", "怎么"]):
        return "Restatement or Paraphrasing + Question + Providing Suggestions"
    return "Reflection of feelings + Restatement or Paraphrasing"


def build_long_term_memory(user_id: str | None, current_state: UserState | None = None) -> dict[str, Any]:
    if not user_id:
        return {"enabled": False, "reason": "missing_user_id"}
    settings = get_user_settings(user_id)
    if settings and not bool(settings.get("long_term_memory_enabled", True)):
        return {"enabled": False, "reason": "disabled_by_user"}

    logs = list_mood_logs(user_id, limit=30)
    analysis = build_longitudinal_state(logs)
    if not logs:
        return {"enabled": True, **analysis, "summary": "暂无长期记录。"}
    if current_state and len(logs) >= 3:
        baseline = analysis["personal_baseline"]
        current_comparisons = {
            "sleep": (current_state.sleep / 2, -1.0, "睡眠低于个人近期基线"),
            "energy": (current_state.energy / 2, 1.0, "精力高于个人近期基线"),
            "impulse": (current_state.impulsivity / 2, 1.0, "冲动高于个人近期基线"),
        }
        existing_metrics = {item.get("metric") for item in analysis["change_signals"]}
        for metric, (current, threshold, label) in current_comparisons.items():
            baseline_value = baseline.get(f"avg_{metric}")
            if baseline_value is None or metric in existing_metrics:
                continue
            delta = round(current - float(baseline_value), 2)
            if (threshold < 0 and delta <= threshold) or (threshold > 0 and delta >= threshold):
                signal = {
                    "metric": metric,
                    "window": "current",
                    "recent": current,
                    "baseline_window": "30d",
                    "baseline": baseline_value,
                    "delta": delta,
                    "label": label,
                }
                analysis["change_signals"].append(signal)
                analysis["evidence"].append(
                    {
                        "metric": metric,
                        "recent_window": "current",
                        "baseline_window": "30d",
                        "recent_value": current,
                        "baseline_value": baseline_value,
                        "delta": delta,
                    }
                )

    state_counts = Counter(str(log.get("state") or "unknown") for log in logs)
    medication_counts = Counter(str(log.get("medication") or "none") for log in logs)
    warning_logs = [
        log
        for log in logs
        if int(log.get("sleep") or 0) <= 2
        or int(log.get("impulse") or 0) >= 4
        or str(log.get("state")) in {"manic", "mixed"}
    ]
    note_terms = Counter()
    for log in logs:
        for term in re.findall(r"[\u4e00-\u9fff]{2,6}|[a-zA-Z]{3,}", str(log.get("notes") or "").lower()):
            if term not in {"今天", "感觉", "有点", "没有", "自己"}:
                note_terms[term] += 1

    dominant_state = state_counts.most_common(1)[0][0]
    window_30 = analysis["windows"]["30d"]
    return {
        "enabled": True,
        **analysis,
        "trend": {
            "avg_mood": window_30.get("avg_mood"),
            "avg_sleep": window_30.get("avg_sleep"),
            "avg_energy": window_30.get("avg_energy"),
            "avg_impulse": window_30.get("avg_impulse"),
            "dominant_state": dominant_state,
            "state_counts": dict(state_counts),
            "medication_counts": dict(medication_counts),
            "warning_days": len(warning_logs),
        },
        "personalization": {
            "support_goals": settings.get("support_goals", []) if settings else [],
            "user_stage": settings.get("user_stage", "ongoing_care") if settings else "ongoing_care",
        },
        "possible_triggers": [term for term, _ in note_terms.most_common(6)],
        "summary": (
            f"最近 {len(logs)} 条记录中，主要状态为 {dominant_state}，"
            f"30 天平均情绪 {window_30.get('avg_mood')}/5，平均睡眠 {window_30.get('avg_sleep')}/5，"
            f"平均冲动 {window_30.get('avg_impulse')}/5；需关注记录 {len(warning_logs)} 次。"
        ),
    }


def build_history_memory(history: list[ChatMessage]) -> dict[str, Any]:
    """Bound context size while retaining recent turns and safety-relevant facts."""
    if not history:
        return {"summary": "暂无历史对话。", "recent_messages": [], "safety_facts": []}
    safety_terms = ["自杀", "自残", "不想活", "伤害", "过量", "停药", "减药", "加药", "楼顶", "跳"]
    facts: list[str] = []
    for item in history:
        if any(term in item.content for term in safety_terms):
            facts.append(f"{item.role}: {item.content[:180]}")
    older = history[:-6]
    themes: list[str] = []
    for term in ["睡眠", "工作", "家人", "药", "低落", "烦躁", "冲动", "孤独"]:
        if any(term in item.content for item in older):
            themes.append(term)
    summary = "较早对话涉及：" + "、".join(themes) if themes else "较早对话无可稳定提取的主题。"
    return {
        "summary": summary,
        "recent_messages": [item.model_dump() for item in history[-6:]],
        "safety_facts": facts[-4:],
        "truncated_messages": max(0, len(history) - 6),
    }


def detect_prompt_attack(message: str) -> dict[str, Any]:
    matches = [p for p in PROMPT_ATTACK_PATTERNS if re.search(p, message, flags=re.IGNORECASE)]
    return {
        "detected": bool(matches),
        "matched_rule_count": len(matches),
        "policy": "treat_as_untrusted_data_and_do_not_reveal_internal_context",
    }


def synthesize_context(req: ChatRequest) -> dict[str, Any]:
    safety = safety_filter(req.message, req.history)
    state_result = infer_bd_state(req.message, req.state, req.history)
    inferred_state = state_result.state
    long_term_memory = build_long_term_memory(req.user_id, req.state)
    assessment = assess_turn(
        req.message,
        safety.model_dump(),
        state_result.model_dump(),
        long_term_memory,
    )
    retrieved_examples = retrieve_examples(req.message, inferred_state, assessment)
    response_plan = plan_response(
        assessment,
        retrieved_examples,
        max_advice_items=MAX_ADVICE_ITEMS,
        max_questions=MAX_QUESTIONS_PER_REPLY,
    )
    selected_strategy = " + ".join(response_plan.strategies)

    return {
        "pipeline_version": "decision-strategy-response-v1",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "user_state": req.state.model_dump(),
        "inferred_bd_state": inferred_state,
        "state_analysis": state_result.model_dump(),
        "safety": safety.model_dump(),
        "turn_assessment": assessment.model_dump(),
        "response_plan": response_plan.model_dump(),
        "selected_support_strategy": selected_strategy,
        "retrieved_examples": retrieved_examples,
        "rag_status": {"ready": retriever.is_ready(), "documents": retriever.count_documents()},
        "long_term_memory": long_term_memory,
        "conversation_memory": build_history_memory(req.history),
        "prompt_attack": detect_prompt_attack(req.message),
        "response_policy": {
            "max_advice_items": MAX_ADVICE_ITEMS,
            "max_questions_per_reply": MAX_QUESTIONS_PER_REPLY,
            "preferred_rag_top_k": RAG_TOP_K,
            "rag_min_score": RAG_MIN_SCORE,
        },
        "dialogue_history": [message.model_dump() for message in req.history[-min(RAG_MAX_HISTORY, 6):]],
        "latest_user_message": req.message,
    }


def crisis_reply(payload: dict[str, Any]) -> str:
    contact = payload["user_state"].get("emergency_contact") or {}
    name = (contact.get("name") or "").strip()
    phone = (contact.get("phone") or "").strip()
    contact_text = "如果你有紧急联系人，也可以马上联系他们。"
    if name or phone:
        label = f"{name} " if name else ""
        number = f"（{phone}）" if phone else ""
        contact_text = f"如果你愿意，请马上联系你的紧急联系人 {label}{number}。"

    risk_level = str((payload.get("safety") or {}).get("risk_level") or "high")
    if risk_level == "high":
        return (
            "我很在意你刚才提到的伤害自己或他人的念头。你不需要独自处理这一刻。"
            "请先和可能造成伤害的物品拉开距离，并马上联系一个能来到你身边的人。\n\n"
            "你也可以立即拨打希望24热线 400-161-9995；如果你觉得自己可能马上行动，请直接拨打 120。"
            f"{contact_text}\n\n"
            "我不会追问方法细节。现在只需要确认一件事：你能否先走到有人在场、相对安全的地方？"
        )
    return (
        "我能感受到你现在真的非常痛苦，这种感觉一定让你快要撑不住了，我很心疼你。"
        "请你先不要做伤害自己或他人的事情，也不要一个人继续扛着。\n\n"
        "现在请你立刻拨打希望24热线 400-161-9995，或者当地急救电话 120；"
        f"{contact_text}\n\n"
        "如果身边有药物、刀具或其他可能让你受伤的东西，请先把它们放到离你远一点的地方，"
        "然后走到有人能看见你的地方。我会继续陪着你，但现在最重要的是让现实中的专业支持尽快介入。"
    )


def fallback_reply(payload: dict[str, Any]) -> str:
    state = payload["inferred_bd_state"]
    strategy = payload["selected_support_strategy"]
    message = payload["latest_user_message"]

    if state == "manic":
        return (
            "我听到你现在像是处在一种很满、很快、很难停下来的状态里。"
            "这不代表你做错了什么，但它确实值得我们先把速度降下来一点。\n\n"
            "先把今天所有重大决定延迟到明天，也就是先延后处理：花钱、辞职、争吵、通宵、突然联系很多人，都先暂停。"
            "你可以现在喝几口水，把屏幕亮度调低，做 5 次慢呼吸，然后给一个可信任的人发消息："
            "“我现在有点停不下来，能不能陪我稳定一下？”\n\n"
            f"我会按“{strategy}”的方式陪你，不急着评判，只先帮你保护睡眠和安全。"
        )
    if state == "depressed":
        return (
            "听起来你真的很累，最近的压力也已经压到身体和情绪上了，而且这种累不是一句“振作点”就能过去的。"
            "你愿意把它说出来，本身就说明你还在努力给自己找一点支撑。\n\n"
            "我们先把目标降到很小：喝一口水、吃一点东西、洗把脸，或者只把身体从床上坐起来 1 分钟。"
            "今天不需要证明自己很强，只要让自己离安全近一点点。\n\n"
            "如果这种无望感继续变重，或者出现伤害自己的想法，请马上联系希望24热线 400-161-9995、120 或你的紧急联系人。"
        )
    if state == "mixed":
        return (
            "我听到这里面既有很强的痛苦，也有一种快要压不住的冲动感。"
            "混合状态会特别折磨人，因为身体像在加速，心里却又很沉。\n\n"
            "现在先不解决全部问题，只做安全优先的三步：离开刺激源，把可能冲动使用的东西放远，联系一个能陪你的人。"
            "接下来 10 分钟里，任何重大决定都先不做。我们先让这阵强度降下来。"
        )

    if "工作" in message or "压力" in message or "累" in message:
        return (
            "听起来你最近真的被工作压得很紧，连吃饭和休息都变成了额外负担。"
            "这种疲惫不是懒，也不是你不够努力，而是身体在提醒你已经透支了。\n\n"
            "先别把所有事情都摊在眼前。你可以只分三栏：今天必须做、可以延期、可以求助。"
            "然后先给自己 10 分钟喝水、伸展、喘口气。等身体稍微回来一点，再处理最小的一件事。"
        )

    return (
        "我听见了。你现在说的这些感受，我不会急着替你下结论。"
        "我们可以先把它当成一个需要被理解的信号，而不是一个必须马上解决的问题。\n\n"
        "如果你愿意，可以告诉我：这件事更像让你焦虑、低落、烦躁，还是让你有点停不下来？"
        "我会根据你现在的状态，陪你找一个今天就能做到的小稳定动作。"
    )


def build_model_input(payload: dict[str, Any]) -> str:
    trusted_context = {
        "assessment": payload.get("turn_assessment"),
        "response_plan": payload.get("response_plan"),
        "longitudinal_evidence": (payload.get("long_term_memory") or {}).get("evidence", []),
        "retrieved_evidence": payload.get("retrieved_examples", []),
        "conversation_memory": payload.get("conversation_memory"),
        "latest_user_message": payload.get("latest_user_message"),
    }
    return (
        "严格执行 response_plan 生成一条面向用户的中文回复。"
        "只把 A 级证据当作医疗事实；B 级只用于支持策略；C 级只能帮助理解语言。"
        "不得暴露内部结构，不得把状态推断写成诊断。\n\n"
        f"{json.dumps(trusted_context, ensure_ascii=False, indent=2)}"
    )


async def call_openai(payload: dict[str, Any]) -> tuple[str, bool]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return fallback_reply(payload), False

    client = OpenAI(api_key=api_key)
    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=SYSTEM_PROMPT,
            input=build_model_input(payload),
            max_output_tokens=MAX_OUTPUT_TOKENS,
        )
        return response.output_text.strip(), True
    except Exception as exc:
        payload["openai_error"] = {
            "type": exc.__class__.__name__,
            "message": str(exc),
        }
        return fallback_reply(payload), False


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/rag/status")
def rag_status() -> dict[str, Any]:
    return {"ready": retriever.is_ready(), "documents": retriever.count_documents()}


def percent(numerator: int | float, denominator: int | float) -> float:
    if not denominator:
        return 0.0
    return round((float(numerator) / float(denominator)) * 100, 2)


def parse_event_properties(row: dict[str, Any]) -> dict[str, Any]:
    try:
        return json.loads(row.get("properties_json") or "{}")
    except json.JSONDecodeError:
        return {}


@app.get("/admin/metrics", response_model=AdminMetricsResponse)
def admin_metrics(
    days: int = Query(default=7, ge=1, le=90),
    token: str | None = Query(default=None),
) -> AdminMetricsResponse:
    if ADMIN_METRICS_TOKEN and token != ADMIN_METRICS_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid admin metrics token")

    rows = list_event_logs(days=days)
    counts = Counter(str(row["event_name"]) for row in rows)
    users = {str(row["user_id"]) for row in rows if row.get("user_id")}
    sessions = {str(row["session_id"]) for row in rows if row.get("session_id")}

    reply_rows = [row for row in rows if row["event_name"] == "assistant_reply_received"]
    reply_props = [parse_event_properties(row) for row in reply_rows]
    response_times = [
        float(props["response_time_ms"])
        for props in reply_props
        if isinstance(props.get("response_time_ms"), (int, float))
    ]
    rag_hits = sum(1 for props in reply_props if props.get("used_rag"))
    openai_hits = sum(1 for props in reply_props if props.get("used_openai"))
    feedback_total = counts["feedback_submitted"]
    feedback_reason_counts = Counter(
        str(parse_event_properties(row).get("label"))
        for row in rows
        if row["event_name"] == "feedback_submitted" and parse_event_properties(row).get("label")
    )
    negative_feedback = sum(
        1
        for row in rows
        if row["event_name"] == "feedback_submitted"
        and parse_event_properties(row).get("label") not in {None, "helpful"}
    )

    app_opened = counts["app_opened"]
    checkin_completed = counts["checkin_completed"]
    chat_started = counts["chat_started"]
    message_sent = counts["message_sent"]
    assistant_replies = counts["assistant_reply_received"]
    crisis_overrides = counts["crisis_override_triggered"]
    hotline_clicks = counts["hotline_clicked"]

    average_response_time = round(sum(response_times) / len(response_times), 2) if response_times else 0.0

    return AdminMetricsResponse(
        window_days=days,
        total_events=len(rows),
        active_users=len(users),
        active_sessions=len(sessions),
        funnel={
            "app_opened": app_opened,
            "privacy_notice_confirmed": counts["privacy_notice_confirmed"],
            "checkin_completed": checkin_completed,
            "chat_started": chat_started,
            "checkin_completion_rate": percent(checkin_completed, app_opened),
            "first_chat_conversion_rate": percent(chat_started, app_opened),
        },
        engagement={
            "message_sent": message_sent,
            "assistant_reply_received": assistant_replies,
            "messages_per_active_user": round(message_sent / len(users), 2) if users else 0.0,
            "feedback_submitted": feedback_total,
            "negative_feedback": negative_feedback,
            "negative_feedback_rate": percent(negative_feedback, feedback_total),
            "feedback_reason_counts": dict(feedback_reason_counts),
            "chat_error": counts["chat_error"],
        },
        safety={
            "risk_detected": counts["risk_detected"],
            "crisis_override_triggered": crisis_overrides,
            "hotline_clicked": hotline_clicks,
            "hotline_click_rate_after_crisis": percent(hotline_clicks, crisis_overrides),
        },
        model_quality={
            "rag_hit_rate": percent(rag_hits, assistant_replies),
            "openai_usage_rate": percent(openai_hits, assistant_replies),
            "average_response_time_ms": average_response_time,
        },
        settings={
            "profile_saved": counts["profile_saved"],
            "emergency_contact_added": counts["emergency_contact_added"],
            "long_term_memory_enabled": counts["long_term_memory_enabled"],
            "long_term_memory_disabled": counts["long_term_memory_disabled"],
            "data_exported": counts["data_exported"],
            "data_delete_requested": counts["data_delete_requested"],
        },
        raw_event_counts=dict(sorted(counts.items())),
    )


@app.post("/safety-filter", response_model=SafetyResult)
def safety_filter_endpoint(req: ChatRequest) -> SafetyResult:
    return safety_filter(req.message, req.history)


@app.post("/synthesize-context")
def synthesize_context_endpoint(req: ChatRequest) -> dict[str, Any]:
    return synthesize_context(req)


@app.post("/feedback")
def feedback(req: FeedbackRequest) -> dict[str, str]:
    append_jsonl(
        FEEDBACK_PATH,
        {
            "case_id": req.case_id,
            "rating": req.rating,
            "label": req.label,
            "comment": req.comment,
            "risk_level": req.risk_level,
            "bd_state": req.bd_state,
            "selected_strategy": req.selected_strategy,
            "user_message": encrypt_text(req.user_message or ""),
            "assistant_reply": encrypt_text(req.assistant_reply or ""),
            "rag_sources": req.rag_sources,
            "used_openai": req.used_openai,
        },
    )
    return {"status": "ok"}


def sanitize_event_properties(properties: dict[str, Any]) -> dict[str, Any]:
    blocked_keys = {
        "message",
        "content",
        "reply",
        "notes",
        "phone",
        "emergency_contact_phone",
        "raw_text",
        "conversation",
    }
    sanitized: dict[str, Any] = {}
    for key, value in properties.items():
        if key in blocked_keys:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            sanitized[key] = value
        elif isinstance(value, list):
            sanitized[key] = [item for item in value if isinstance(item, (str, int, float, bool))][:20]
        elif isinstance(value, dict):
            sanitized[key] = {
                nested_key: nested_value
                for nested_key, nested_value in value.items()
                if nested_key not in blocked_keys and isinstance(nested_value, (str, int, float, bool))
            }
    return sanitized


@app.post("/events", response_model=EventLogResponse)
def create_event(req: EventLogRequest) -> EventLogResponse:
    event_id = req.id or str(uuid.uuid4())
    save_event_log(
        {
            "id": event_id,
            "user_id": req.user_id,
            "session_id": req.session_id,
            "event_name": req.event_name,
            "event_time": req.event_time or datetime.now().isoformat(timespec="seconds"),
            "properties_json": json.dumps(sanitize_event_properties(req.properties), ensure_ascii=False),
            "app_version": req.app_version,
            "platform": req.platform,
        }
    )
    return EventLogResponse(status="ok", id=event_id)


@app.post("/mood-logs", response_model=MoodLogResponse)
def create_mood_log(req: MoodLogRequest) -> MoodLogResponse:
    saved = save_mood_log(req.model_dump())
    return MoodLogResponse(**saved)


@app.get("/mood-logs", response_model=list[MoodLogResponse])
def get_mood_logs(
    user_id: str = Query(min_length=3, max_length=120),
    limit: int = Query(default=30, ge=1, le=90),
) -> list[MoodLogResponse]:
    return [MoodLogResponse(**row) for row in list_mood_logs(user_id=user_id, limit=limit)]


def default_user_settings(user_id: str) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "display_name": "",
        "age_range": "",
        "diagnosis_status": "",
        "support_goals": ["warning_signs"],
        "user_stage": "ongoing_care",
        "emergency_contact_name": "",
        "emergency_contact_phone": "",
        "emergency_contact_relation": "",
        "allow_emergency_contact_prompt": True,
        "daily_checkin_enabled": True,
        "daily_checkin_time": "08:30",
        "medication_enabled": False,
        "medication_time": "21:00",
        "appointment_enabled": True,
        "appointment_date": "",
        "weekly_review_enabled": True,
        "weekly_review_day": 0,
        "weekly_review_time": "19:30",
        "long_term_memory_enabled": True,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }


@app.get("/user-settings", response_model=UserSettingsResponse)
def read_user_settings(user_id: str = Query(min_length=3, max_length=120)) -> UserSettingsResponse:
    row = get_user_settings(user_id) or default_user_settings(user_id)
    return UserSettingsResponse(**row)


@app.post("/user-settings", response_model=UserSettingsResponse)
def upsert_user_settings(req: UserSettingsRequest) -> UserSettingsResponse:
    data = req.model_dump()
    data["updated_at"] = data["updated_at"] or datetime.now().isoformat(timespec="seconds")
    saved = save_user_settings(data)
    return UserSettingsResponse(**saved)


@app.post("/delete-user-data")
def remove_user_data(req: DeleteUserDataRequest) -> dict[str, str]:
    delete_user_data(req.user_id)
    return {"status": "deleted"}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    started_at = time.perf_counter()
    payload = synthesize_context(req)
    safety = payload["safety"]
    if safety["should_override_llm"]:
        reply = crisis_reply(payload)
        used_openai = False
    else:
        reply, used_openai = await call_openai(payload)
    reply, output_guardrail = apply_output_guardrail(reply, payload)
    payload["output_guardrail"] = {
        "passed": output_guardrail.passed,
        "violations": output_guardrail.violations,
        "rewritten": output_guardrail.rewritten,
    }

    response = ChatResponse(
        reply=reply,
        risk_level=safety["risk_level"],
        selected_strategy=payload["selected_support_strategy"],
        context_payload=payload,
        used_openai=used_openai,
        assessment=payload["turn_assessment"],
        response_plan=payload["response_plan"],
        pipeline_version=payload["pipeline_version"],
    )
    latency_ms = round((time.perf_counter() - started_at) * 1000)
    append_jsonl(
        INTERACTION_LOG_PATH,
        {
            "risk_level": response.risk_level,
            "bd_state": payload.get("inferred_bd_state"),
            "selected_strategy": response.selected_strategy,
            "used_openai": response.used_openai,
            "rag_ready": payload.get("rag_status", {}).get("ready"),
            "rag_documents": payload.get("rag_status", {}).get("documents"),
            "retrieved_count": len(payload.get("retrieved_examples") or []),
            "output_guardrail_passed": output_guardrail.passed,
            "output_guardrail_rewritten": output_guardrail.rewritten,
            "output_guardrail_violations": output_guardrail.violations,
            "rag_top_source": (payload.get("retrieved_examples") or [{}])[0].get("source")
            if payload.get("retrieved_examples")
            else None,
            "latency_ms": latency_ms,
            "message_length": len(req.message),
            "history_turns": len(req.history),
            "long_term_memory_enabled": bool(payload.get("long_term_memory", {}).get("enabled")),
            "long_term_memory_records": int(payload.get("long_term_memory", {}).get("record_count") or 0),
        },
    )
    return response
