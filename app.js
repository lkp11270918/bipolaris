const icons = {
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  bar: '<path d="M3 3v18h18"/><path d="M8 17V9"/><path d="M13 17V5"/><path d="M18 17v-4"/>',
  bell: '<path d="M10 21h4"/><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
  bolt: '<path d="m13 2-9 13h7l-1 7 9-13h-7l1-7Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  pencil: '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.5A6.5 6.5 0 0 0 10 11.5 6.5 6.5 0 0 1 16.5 5H22"/><path d="M2 6h1.5A6.5 6.5 0 0 1 10 12.5 6.5 6.5 0 0 0 16.5 19H22"/>',
  sleep: '<path d="M4 11h16"/><path d="M4 17h16"/><path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4"/><path d="M5 17v3"/><path d="M19 17v3"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z"/><path d="M19 18v4"/><path d="M17 20h4"/>',
  star: '<path d="m12 2 3 6.4 7 .7-5.2 4.7 1.5 6.9L12 17.2 5.7 20.7l1.5-6.9L2 9.1l7-.7Z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  warning: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/>',
  zap: '<path d="M4 14a7 7 0 0 1 14 0"/><path d="M7 14a5 5 0 0 0 10 0"/><path d="M12 4v4"/><path d="M4 20h16"/>',
};

const stateLabels = {
  stable: "平稳",
  manic: "偏躁",
  depressed: "低落",
  mixed: "混合",
};

const routines = [
  "固定起床和睡觉时间",
  "吃一顿稳定的正餐",
  "10分钟轻运动或伸展",
  "记录一次情绪与睡眠",
  "按医嘱服药并留意副作用",
];

const crisisTerms = [
  "自杀",
  "轻生",
  "了结",
  "不想活",
  "活着没意义",
  "结束这一切",
  "伤害自己",
  "自残",
  "割腕",
  "跳楼",
  "吃药死",
  "过量",
  "伤害别人",
  "杀了",
  "控制不住",
  "砸东西",
  "撞",
  "毁掉",
];

const manicTerms = ["睡不着", "精力很高", "停不下来", "话很多", "冲动", "花钱", "冒险", "脑子很快", "烦躁"];
const depressedTerms = ["低落", "没力气", "无望", "没意义", "疲惫", "不想动", " worthless", "难过", "撑不住"];

let currentState = "stable";
let lastRisk = "low";
let lastPayload = null;
const conversationHistory = [];
const apiBaseUrl = (window.BIPOLARIS_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const messages = document.querySelector("#messages");
const template = document.querySelector("#messageTemplate");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#chatInput");
const safetyCard = document.querySelector("#safetyCard");

function initIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
  });
}

function addMessage(role, text, options = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  if (options.crisis) node.classList.add("crisis");
  node.querySelector(".bubble").textContent = text;
  node.querySelector("time").textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  messages.append(node);
  messages.scrollTop = messages.scrollHeight;
  if (!options.skipHistory) {
    conversationHistory.push({ role, content: text });
    if (conversationHistory.length > 16) conversationHistory.shift();
  }
}

function hasAnyTerm(text, terms) {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  return terms.some((term) => normalized.includes(term.toLowerCase().replace(/\s+/g, "")));
}

function crisisReply() {
  const name = document.querySelector("#contactName").value.trim();
  const phone = document.querySelector("#contactPhone").value.trim();
  const contact = name || phone ? `如果你愿意，也请马上联系你的紧急联系人${name ? ` ${name}` : ""}${phone ? `（${phone}）` : ""}。` : "如果你有可信任的人在身边，请现在告诉 TA 你需要陪伴。";

  return `我能感受到你现在真的非常痛苦，这种感觉一定让你快要撑不住了。请先不要独自承受，也不要做伤害自己或他人的事情。\n\n现在请你立刻拨打希望24热线 400-161-9995，或者当地急救电话 120。${contact}\n\n我会继续在这里陪着你，但这类情况需要现实中的专业支持一起介入。你现在可以先把危险物品或药物放远一点，走到有人能看见你的地方，然后拨打上面的电话。`;
}

function stateAwareReply(text) {
  const sleep = Number(document.querySelector("#sleepRange").value);
  const energy = Number(document.querySelector("#energyRange").value);
  const impulse = Number(document.querySelector("#impulseRange").value);
  const inferredManic = currentState === "manic" || hasAnyTerm(text, manicTerms) || (sleep <= 3 && energy >= 7);
  const inferredDepressed = currentState === "depressed" || hasAnyTerm(text, depressedTerms) || (energy <= 3 && sleep <= 4);
  const inferredMixed = currentState === "mixed" || (inferredManic && inferredDepressed);

  if (inferredMixed) {
    return `听起来你现在可能同时有很强的情绪拉扯：一部分很急、很满，另一部分又很累或很沉。这种“混合”的感觉会让人特别难受，也更容易冲动，所以我们先把目标放小一点。\n\n接下来 10 分钟只做三件事：把刺激源降下来，喝几口水，把手机里可能让你继续上头的信息先放一边。然后选一个可信任的人发一句：“我现在状态很乱，能不能陪我待一会儿？”\n\n你不用马上把所有问题解决。先让身体慢一点，我会跟着你的节奏来。`;
  }

  if (inferredManic || impulse >= 7) {
    return `我听到你现在的能量和冲动感都比较高，脑子可能转得很快。先不急着做决定，尤其是花钱、辞职、吵架、熬夜或冒险这类决定，最好先延迟 24 小时。\n\n我们可以先做一个降速动作：把灯光调暗一点，喝水，离开容易刺激你的环境，做 5 次慢呼吸。然后写下“我现在最想做的事”和“如果明天再决定，会损失什么”。很多时候，给决定一点时间，就是在保护未来的你。`;
  }

  if (inferredDepressed) {
    return `听起来你真的累了，而且这种累不是简单休息一下就能完全恢复的那种。你能把它说出来已经很不容易，我会认真陪你把这段时间慢慢熬过去。\n\n今天不需要逼自己完成很多事。先选一个最小动作就好：喝一杯水、吃一点东西、洗把脸，或者只是在窗边坐 3 分钟。完成一件很小的事，也算是在把自己往安全的地方拉回一点。\n\n如果这种低落持续加重，或者你开始出现伤害自己的想法，请立刻联系专业支持或拨打热线。`;
  }

  if (text.includes("工作") || text.includes("压力") || text.includes("累")) {
    return `听起来你最近承受了不少压力，身体和情绪都在提醒你需要一点缓冲。你不需要把所有事情一次性处理完，可以先把任务分成“必须今天做”“可以延期”“需要别人帮忙”三类。\n\n现在先给自己 10 分钟，喝水、伸展、把呼吸放慢。等身体稍微回来一点，再选一个最小任务开始。稳定节奏比硬撑更重要。`;
  }

  return `我听见了。谢谢你愿意把这些感受告诉我。我们先不急着判断它对不对，也不急着把它修好，先承认：你现在确实在经历一些不容易的东西。\n\n如果你愿意，可以继续告诉我：这件事更像是让你焦虑、难过、烦躁，还是让你停不下来？我会根据你现在的状态，和你一起找一个足够小、今天就能做的稳定动作。`;
}

function updateSafety(risk) {
  lastRisk = risk;
  const isCrisis = risk === "crisis";
  safetyCard.classList.toggle("crisis", isCrisis);
  safetyCard.querySelector("b").textContent = isCrisis ? "安全状态：需要立即帮助" : "安全状态：良好";
  safetyCard.querySelector("div span").textContent = isCrisis
    ? "检测到严重危机信号。请优先联系热线、急救电话或紧急联系人。"
    : "普通支持模式。若你提到自伤、自杀、伤害他人或失控冲动，我会优先给出危机帮助。";
  document.querySelector("#dockSafety").textContent = isCrisis ? "需要帮助" : "良好";
  document.querySelector("#riskLevel").textContent = isCrisis ? "高风险" : "低风险";
}

function collectBackendState() {
  const medicationSchedule = Array.from(document.querySelectorAll("[data-med]"))
    .filter((item) => item.checked)
    .map((item) => item.dataset.med);
  const completedRoutines = Array.from(document.querySelectorAll("#routineList input:checked")).map((item) =>
    item.parentElement.textContent.trim()
  );
  const warningSigns = Array.from(document.querySelectorAll(".right-panel .check-row input:checked"))
    .filter((item) => !item.dataset.med)
    .map((item) => item.parentElement.textContent.trim());

  return {
    mood_state: currentState,
    sleep: Number(document.querySelector("#sleepRange").value),
    energy: Number(document.querySelector("#energyRange").value),
    impulsivity: Number(document.querySelector("#impulseRange").value),
    medication_schedule: medicationSchedule,
    completed_routines: completedRoutines,
    warning_signs: warningSigns,
    emergency_contact: {
      name: document.querySelector("#contactName").value.trim(),
      phone: document.querySelector("#contactPhone").value.trim(),
    },
  };
}

async function requestBackendReply(text) {
  const payload = {
    message: text,
    state: collectBackendState(),
    history: conversationHistory.filter((message) => message.role === "user" || message.role === "assistant").slice(-8),
  };

  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json();
}

function updateModelTrace(data, connected) {
  const trace = document.querySelector("#modelTrace");
  if (!trace) return;
  if (!connected) {
    trace.textContent = "未连接 FastAPI，当前为前端 fallback 回复";
    return;
  }
  const model = data.used_openai ? "OpenAI Responses API" : "后端安全/降级回复";
  trace.textContent = `${model} · ${data.selected_strategy}`;
}

async function handleUserText(text) {
  addMessage("user", text);
  const crisis = hasAnyTerm(text, crisisTerms);
  updateSafety(crisis ? "crisis" : "low");

  try {
    const data = await requestBackendReply(text);
    lastPayload = data.context_payload;
    updateSafety(data.risk_level === "crisis" ? "crisis" : "low");
    updateModelTrace(data, true);
    addMessage("assistant", data.reply, { crisis: data.risk_level === "crisis" });
  } catch (error) {
    updateModelTrace(null, false);
    window.setTimeout(() => {
      const fallback = crisis ? crisisReply() : stateAwareReply(text);
      addMessage("assistant", `（未连接后端模型服务，以下为本地 fallback 回复）\n\n${fallback}`, { crisis });
    }, 280);
  }
}

function renderRoutines() {
  const container = document.querySelector("#routineList");
  container.innerHTML = "";
  routines.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "routine-item";
    label.innerHTML = `<input type="checkbox" ${index < 2 ? "checked" : ""} /> <span>${item}</span>`;
    container.append(label);
  });
}

function setState(state) {
  currentState = state;
  document.querySelectorAll(".state-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.state === state);
  });
  document.querySelector("#dockState").textContent = stateLabels[state];
}

function bindEvents() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    handleUserText(text);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.querySelectorAll(".state-card").forEach((button) => {
    button.addEventListener("click", () => setState(button.dataset.state));
  });

  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const output = range.parentElement.querySelector("output");
    range.addEventListener("input", () => {
      output.textContent = range.value;
    });
  });

  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.prompt;
      input.focus();
    });
  });

  document.querySelector("#logStateButton").addEventListener("click", () => {
    const sleep = document.querySelector("#sleepRange").value;
    const energy = document.querySelector("#energyRange").value;
    const impulse = document.querySelector("#impulseRange").value;
    handleUserText(`我想记录一下状态：当前是${stateLabels[currentState]}，睡眠 ${sleep}/10，精力 ${energy}/10，冲动 ${impulse}/10。`);
  });

  document.querySelector("#groundingButton").addEventListener("click", () => {
    handleUserText("我想做一个 5-4-3-2-1 稳定练习。");
  });

  document.querySelector("#resetRoutineButton").addEventListener("click", renderRoutines);

  document.querySelector("#clearChatButton").addEventListener("click", () => {
    messages.innerHTML = "";
    updateSafety("low");
    addWelcomeMessage();
  });

  document.querySelector("#privacyButton").addEventListener("click", () => {
    addMessage("assistant", "隐私提示：这个原型在本地浏览器中运行，不会把你的输入发送到服务器。正式产品仍应加入加密存储、明确授权、数据删除和危机干预记录规则。");
  });

  const payloadButton = document.querySelector("#payloadButton");
  if (payloadButton) {
    payloadButton.addEventListener("click", () => {
      if (!lastPayload) {
        addMessage("assistant", "还没有后端 Context Payload。请先启动 FastAPI 服务并发送一条消息。", { skipHistory: true });
        return;
      }
      addMessage("assistant", `最近一次隐藏 Context Payload：\n${JSON.stringify(lastPayload, null, 2)}`, { skipHistory: true });
    });
  }
}

function addWelcomeMessage() {
  addMessage(
    "assistant",
    "你好，我是 BiPolaris。你可以告诉我今天的状态，或者先选择左侧的“平稳、偏躁、低落、混合”。\n\n我会尽量用温暖、非评判的方式陪你整理情绪；如果出现自伤、自杀、伤害他人或失控冲动的信号，我会优先给出危机帮助。"
  );
}

initIcons();
renderRoutines();
bindEvents();
addWelcomeMessage();
