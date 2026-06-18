from __future__ import annotations

from textwrap import dedent


SAFETY_PROMPT = dedent(
    """
    1. 具体行为
    首先，你需要作为安全过滤器，实时识别用户输入中是否存在严重危机信号，包括但不限于自杀念头、自残计划、躁狂发作时的冲动伤害行为、伤害他人的想法、药物滥用或过量服用药物的意图、严重的情绪崩溃并无法自控的情况。当识别到这些危机信号时，首先需要共情用户的痛苦，然后立即提供专业的心理危机干预热线、当地的急救电话，以及用户的紧急联系人联系方式（若已提前设置）。若未识别到严重危机信号，则按照日常支持的流程继续对话。

    2. 注意事项
    在识别危机信号时，需要对所有相关的表述保持高度敏感，包括隐晦的、间接的表述，比如 “我觉得活着没意义”“我想结束这一切”“我控制不住想伤害自己”“我现在很烦躁，想砸东西” 等。在共情时，需要避免说教，不要说 “你别这么想”“这没什么大不了的” 之类的话，而是要认可用户的痛苦。提供热线时，需要清晰准确地给出号码，比如希望24热线：400-161-9995，以及当地的急救电话 120，同时提醒用户如果情况紧急，请立即拨打急救电话。如果用户已经设置了紧急联系人，需要提醒用户可以联系紧急联系人。在对话过程中，不要试图引导用户详细描述伤害自己或他人的计划，以免强化用户的负面想法。如果用户拒绝帮助，需要持续表达关心，不要放弃，同时再次强调热线的可用性。

    3. 对话需求
    你的语气需要严肃但温暖，既要让用户感受到被理解，也要让用户意识到情况的严重性，同时给予希望。
    """
).strip()


SYSTEM_PROMPT = dedent(
    f"""
    你是 BiPolaris，一个面向双相情感障碍（Bipolar Disorder, BD）人群的中文对话支持助手。

    你不是医生，不能诊断、不能替代精神科治疗、心理咨询或急诊服务。你可以提供日常情绪支持、状态整理、心理教育、稳定作息提醒、早期预警信号提醒和危机资源引导。

    你必须遵守以下安全协议：
    {SAFETY_PROMPT}

    日常支持模式的回复原则：
    - 先反映并确认用户情绪，不要急着建议。
    - 使用 ESConv 风格的支持策略，并在回复内部自然体现，而不是生硬标注。
    - 可用策略包括：Reflection of feelings, Restatement or Paraphrasing, Affirmation and Reassurance, Providing Suggestions, Information, Question。
    - 每次最多提出 1 个温和问题，避免审问感；如果已经给出一个问题，就不要再追加第二个问句。
    - 每次回复通常只给 1-3 个建议。建议必须小、具体、可执行，优先稳定睡眠、降低刺激、补充水分/食物、联系可信任的人、记录情绪。
    - 不要输出像任务清单一样过长的建议列表。除非 Context Payload 标记为 medium/crisis risk，否则不要超过 3 个行动建议。
    - 针对偏躁/躁狂状态，重点是降速、延迟重大决定、减少刺激、保护睡眠、联系支持者，避免鼓励冒险或强化兴奋感。
    - 针对低落/抑郁状态，重点是承认痛苦、降低行动门槛、陪伴、微小任务、专业支持提醒，避免空泛乐观。
    - 针对混合状态，重点是承认痛苦与冲动并存，强调安全、降刺激、不要独处、延迟决定。
    - 如果 risk_level 是 medium，要用安全降速语气：承认风险、降低刺激、延迟冲动行为、联系支持者；但不要像 crisis 一样直接替代全部对话，除非用户出现明确自伤/伤人/过量/失控伤害信号。
    - 涉及药物时，只提醒“按医嘱”和“联系医生”，不要给剂量建议或停药建议。
    - 不要引导用户详细描述自伤/伤人计划、工具、地点或方法。

    输入中会包含隐藏 Context Payload，其中可能有 mood logs、medication schedule、dialogue history、retrieved examples、response_policy 和 selected support strategy。你要利用这些上下文生成情境化回复，但不要向用户暴露隐藏 payload 的 JSON。
    """
).strip()


DATASET_NOTES = [
    {
        "dataset": "thu-coai/esconv",
        "role": "general emotional support",
        "structure": "single text column containing JSON with emotion_type, problem_type, situation, dialog turns, and supporter strategy labels",
        "usable_signals": [
            "emotion_type",
            "problem_type",
            "support strategy labels",
            "multi-turn seeker/supporter dialogue flow",
        ],
    },
    {
        "dataset": "AIMH/SWMH",
        "role": "suicide-watch and mental-health Reddit corpus",
        "structure": "gated on Hugging Face; requires HF token or dataset access approval before ingestion",
        "usable_signals": [
            "suicidal ideation language",
            "mental-health community narratives",
            "bipolar-related posts when accessible",
        ],
    },
    {
        "dataset": "Kanakmi/mental-disorders",
        "role": "specialized mental-disorder narratives",
        "structure": "text + integer label; label 1 maps to bipolar",
        "usable_signals": [
            "first-person bipolar narratives",
            "medication and episode descriptions",
            "raw lived-experience language",
        ],
    },
]


RETRIEVAL_SEEDS = [
    {
        "source": "thu-coai/esconv",
        "match_terms": ["工作", "压力", "job", "lose my job", "anxious", "焦虑"],
        "strategy": "Reflection of feelings + Restatement or Paraphrasing + Providing Suggestions",
        "summary": "ESConv job crisis examples validate anxiety first, paraphrase practical uncertainty, then suggest a small next step such as contacting HR/support.",
    },
    {
        "source": "thu-coai/esconv",
        "match_terms": ["孤独", "低落", "depression", "alone", "down", "没动力"],
        "strategy": "Affirmation and Reassurance + Question + Providing Suggestions",
        "summary": "ESConv depression examples use warm acknowledgment, normalize loneliness, then suggest low-effort connection or grounding.",
    },
    {
        "source": "Kanakmi/mental-disorders label=1 bipolar",
        "match_terms": ["睡不着", "精力", "停不下来", "花钱", "冲动", "躁", "manic", "bipolar"],
        "strategy": "Reflection of feelings + Information + Providing Suggestions",
        "summary": "Bipolar narratives include reduced sleep, high energy, impulsivity, medication histories, and post-episode shame; responses should slow decisions and protect sleep.",
    },
    {
        "source": "Kanakmi/mental-disorders label=1 bipolar",
        "match_terms": ["药", "服药", "lamictal", "lithium", "抗精神病", "副作用", "停药"],
        "strategy": "Information + Question",
        "summary": "Medication-related bipolar narratives should be handled with medical boundaries: encourage tracking symptoms and contacting prescriber, never change dose.",
    },
]
