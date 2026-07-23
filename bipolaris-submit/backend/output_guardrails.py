from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


QUESTION_MARKS = "？?"
VALID_HOTLINES = ("400-161-9995", "120")

DIAGNOSIS_PATTERNS = [
    r"(我可以|我能|我来)?(诊断|确诊)你",
    r"你(就是|已经是|肯定是|一定是)(双相|躁郁症|抑郁症|躁狂|轻躁狂)",
    r"这(就是|属于|肯定是|一定是)(双相|躁郁症|抑郁症|躁狂|轻躁狂)",
]

MEDICATION_PATTERNS = [
    r"可以(直接|先|马上|今晚|自行)?(停药|加药|减药|换药|补服)",
    r"建议你(停药|加药|减药|换药|补服)",
    r"(把|将).{0,12}(剂量|药量).{0,12}(加到|减到|调整到)",
    r"\d+(\.\d+)?\s*(mg|毫克|片).{0,16}(每天|每日|一日|一次|两次|三次)",
]

HARM_ELABORATION_PATTERNS = [
    r"(具体|详细).{0,10}(怎么|如何).{0,10}(自杀|轻生|自残|伤害自己|伤害别人|杀)",
    r"(打算|准备用|想用).{0,16}(什么工具|什么方法|哪里|地点).{0,16}(自杀|轻生|自残|伤害|杀)",
    r"(刀|药|绳|楼|车).{0,12}(具体|详细).{0,12}(怎么用|在哪里|什么时候)",
]

DISMISSIVE_PATTERNS = [
    r"你别这么想",
    r"这没什么大不了",
    r"别想太多",
    r"你太脆弱",
]

MEDICATION_CONTEXT_TERMS = ["药", "停药", "加药", "减药", "换药", "补服", "剂量", "副作用", "安眠药", "锂", "拉莫三嗪"]
DIAGNOSIS_CONTEXT_TERMS = ["是不是双相", "是不是躁郁", "诊断", "确诊", "轻躁狂", "躁狂", "抑郁症"]
MEDIUM_SAFETY_TERMS = ["120", "放远", "拉开距离", "离开", "安全", "延迟", "延后", "暂停", "联系"]

WRONG_HOTLINE_PATTERNS = [
    r"希望24热线[：:\s-]*(?!400-161-9995)\d[\d\s-]{5,}",
    r"急救电话[：:\s-]*(?!120\b)\d[\d\s-]{2,}",
]


@dataclass
class OutputGuardrailResult:
    passed: bool
    violations: list[str] = field(default_factory=list)
    rewritten: bool = False
    original_reply: str = ""


def count_questions(text: str) -> int:
    text = re.sub(r"“[^”]*”", "", text)
    text = re.sub(r'"[^"]*"', "", text)
    marks = sum(text.count(mark) for mark in QUESTION_MARKS)
    if marks:
        return marks
    return len(re.findall(r"(吗|能不能|可以吗|愿意|是不是|要不要)", text))


def _matches_any(patterns: list[str], text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def inspect_output(reply: str, payload: dict[str, Any]) -> OutputGuardrailResult:
    violations: list[str] = []
    risk_level = str((payload.get("safety") or {}).get("risk_level") or "low")
    latest_message = str(payload.get("latest_user_message") or "")

    if _matches_any(DIAGNOSIS_PATTERNS, reply):
        violations.append("diagnosis_claim")
    if _matches_any(MEDICATION_PATTERNS, reply):
        violations.append("medication_instruction")
    if _matches_any(HARM_ELABORATION_PATTERNS, reply):
        violations.append("harm_plan_elaboration")
    if _matches_any(DISMISSIVE_PATTERNS, reply):
        violations.append("dismissive_language")
    if _matches_any(WRONG_HOTLINE_PATTERNS, reply):
        violations.append("wrong_hotline")
    if risk_level == "crisis" and not all(hotline in reply for hotline in VALID_HOTLINES):
        violations.append("missing_crisis_hotline")
    if risk_level == "medium" and not any(term in reply for term in MEDIUM_SAFETY_TERMS):
        violations.append("medium_safety_missing")
    if any(term in latest_message for term in MEDICATION_CONTEXT_TERMS) and not any(
        term in reply for term in ["医嘱", "医生", "药师"]
    ):
        violations.append("medication_boundary_missing")
    if any(term in latest_message for term in DIAGNOSIS_CONTEXT_TERMS) and not (
        ("诊断" in reply and any(term in reply for term in ["不能", "无法", "不提供", "医生"]))
    ):
        violations.append("diagnosis_boundary_missing")

    max_questions = int((payload.get("response_policy") or {}).get("max_questions_per_reply") or 1)
    if count_questions(reply) > max_questions:
        violations.append("too_many_questions")

    return OutputGuardrailResult(
        passed=not violations,
        violations=violations,
        original_reply=reply,
    )


def _emergency_contact_text(payload: dict[str, Any]) -> str:
    contact = (payload.get("user_state") or {}).get("emergency_contact") or {}
    name = str(contact.get("name") or "").strip()
    phone = str(contact.get("phone") or "").strip()
    if name or phone:
        label = f"{name} " if name else ""
        number = f"（{phone}）" if phone else ""
        return f"如果你愿意，也请马上联系你的紧急联系人 {label}{number}。"
    return "如果你有紧急联系人，也可以马上联系他们。"


def _safe_crisis_reply(payload: dict[str, Any]) -> str:
    return (
        "我能感受到你现在真的非常痛苦，这种感觉一定让你很难独自承受。"
        "请你先不要伤害自己或他人，也不要一个人继续扛着。\n\n"
        "现在请立刻拨打希望24热线 400-161-9995，或者当地急救电话 120。"
        f"{_emergency_contact_text(payload)}\n\n"
        "如果身边有药物、刀具或其他可能让你受伤的东西，请先把它们放远一点，"
        "走到有人能看见你的地方，等待现实中的专业支持介入。"
    )


def _safe_boundary_reply(payload: dict[str, Any], violations: list[str]) -> str:
    risk_level = str((payload.get("safety") or {}).get("risk_level") or "low")
    latest_message = str(payload.get("latest_user_message") or "")

    if risk_level == "crisis":
        return _safe_crisis_reply(payload)

    if risk_level == "medium" and "medium_safety_missing" in violations:
        return (
            "我听到你现在有些失控或冲动的风险，这种状态需要先把安全放在第一位。"
            "请先暂停任何重大决定或冲动行为，把可能让你受伤、砸坏东西或做出冒险决定的物品放远，"
            "尽量离开刺激源，走到更安全的地方。\n\n"
            "接下来先延迟 10 分钟再行动，喝水、坐稳、慢慢呼吸，并联系一个可信任的人陪你。"
            "如果你担心自己会伤害自己或他人，或者已经无法控制行为，请立即拨打 120。"
        )

    if "medication_instruction" in violations or "medication_boundary_missing" in violations:
        return (
            "我理解你想尽快弄清楚用药问题，尤其当药物影响状态时，这种不安很真实。"
            "但我不能替你判断是否停药、加药、减药、补服或调整剂量。\n\n"
            "比较安全的做法是：先按医嘱执行，把今天的感受、睡眠、冲动程度和不适反应记录下来，"
            "尽快联系开药医生或药师确认。如果已经过量服药、出现明显身体不适或有伤害自己的冲动，请立即拨打 120。"
        )

    if "diagnosis_claim" in violations or "diagnosis_boundary_missing" in violations:
        return (
            "你描述的状态值得认真对待，但我不能根据一段对话给出诊断结论。"
            "我可以帮你把近期的睡眠、情绪、精力、冲动和触发事件整理成复诊时可以带给医生的信息。\n\n"
            "如果这些变化已经影响到安全、工作、人际或用药，请尽快联系精神科医生或心理健康专业人员。"
        )

    if "harm_plan_elaboration" in violations:
        return _safe_crisis_reply(payload)

    return (
        "我听到你现在并不好受。为了安全起见，我先不继续追问可能加重风险的细节。"
        "我们可以先把注意力放在此刻：坐稳、喝一口水、把可能让你冲动的东西放远，"
        "然后联系一个可信任的人陪你待一会儿。"
    )


def apply_output_guardrail(reply: str, payload: dict[str, Any]) -> tuple[str, OutputGuardrailResult]:
    result = inspect_output(reply, payload)
    if result.passed:
        return reply, result

    guarded_reply = _safe_boundary_reply(payload, result.violations)
    result.rewritten = guarded_reply != reply
    return guarded_reply, result
