const API_BASE_URL =
  window.BIPOLARIS_CONFIG?.apiBaseUrl?.replace(/\/$/, "") || "https://bipolaris-api.onrender.com"

const STORAGE = {
  phase: "bipolaris_phase",
  checkin: "bipolaris_checkin",
  logs: "bipolaris_mood_logs",
  anon: "bipolaris_anonymous_user_id",
}

const app = document.querySelector("#app")

const defaultCheckin = {
  mood: 3,
  sleep: 3,
  energy: 3,
  impulse: 1,
  medication: "taken",
  state: "stable",
  notes: "",
}

const stateLabels = {
  stable: "平稳",
  depressed: "抑郁相",
  manic: "躁狂相",
  mixed: "混合",
  unknown: "未知",
}

const medicationLabels = {
  taken: "已按时服药",
  partial: "部分服药",
  missed: "忘记服药",
  none: "无需服药",
}

let phase = localStorage.getItem(STORAGE.phase) || "welcome"
let activeTab = "chat"
let checkin = readJson(STORAGE.checkin, defaultCheckin)
let checkinStep = 0
let agreed = false
let messages = []
let isTyping = false
let showCrisis = false

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function getAnonymousUserId() {
  const existing = localStorage.getItem(STORAGE.anon)
  if (existing) return existing
  const id = `anon_${crypto.randomUUID()}`
  localStorage.setItem(STORAGE.anon, id)
  return id
}

function setPhase(next) {
  phase = next
  localStorage.setItem(STORAGE.phase, next)
  render()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function render() {
  if (phase === "welcome") return renderWelcome()
  if (phase === "disclaimer") return renderDisclaimer()
  if (phase === "checkin") return renderCheckin()
  return renderMain()
}

function renderWelcome() {
  app.innerHTML = `
    <section class="screen welcome">
      <div>
        <div class="logo">B</div>
        <h1>Bipolaris</h1>
        <p class="lead">专为双相情感障碍设计的<br />AI 情绪陪伴助手</p>
      </div>
      <div class="feature-list">
        ${feature("状态感知支持", "根据平稳、抑郁、躁狂或混合状态提供更贴近处境的回复。", "心")}
        ${feature("危机识别与分流", "识别高风险信号，在危机时刻引导你获得真实帮助。", "盾")}
        ${feature("复诊状态摘要", "记录每日情绪波动，帮助整理复诊前的状态信息。", "记")}
      </div>
      <div>
        <button class="primary-button" data-action="go-disclaimer">了解更多并开始</button>
        <p class="fine-print">本产品不替代医疗诊断与治疗</p>
      </div>
    </section>
  `
}

function feature(title, desc, mark) {
  return `
    <article class="feature">
      <div class="feature-mark">${mark}</div>
      <div><b>${title}</b><span>${desc}</span></div>
    </article>
  `
}

function renderDisclaimer() {
  app.innerHTML = `
    <section class="screen">
      <div class="scroll">
        <div class="logo">B</div>
        <h2 class="disclaimer-title">使用前，请先了解</h2>
        <p class="muted">Bipolaris 是一款情绪支持工具，不是医疗产品。</p>
        <div class="card-list" style="margin-top: 24px">
          ${card("我们不替代医生", "Bipolaris 无法诊断疾病、开具处方或调整用药。所有医疗决策请遵医嘱。")}
          ${card("危机时请拨打热线", "若您出现伤害自己或他人的想法，请立即拨打希望24热线 400-161-9995 或急救电话 120。")}
          ${card("您的数据受到保护", "当前版本主要使用本机浏览器存储状态记录，你可以随时清除浏览器数据。")}
          ${card("产品仍在早期阶段", "AI 存在错误和局限。如果回复让你不舒服，请停止使用并寻求专业帮助。")}
        </div>
        <label class="checkbox-row">
          <input type="checkbox" ${agreed ? "checked" : ""} data-action="toggle-agree" />
          <span>我已阅读并理解以上内容，同意用户协议与隐私政策。</span>
        </label>
      </div>
      <div class="bottom-action">
        <button class="primary-button" data-action="start-checkin" ${agreed ? "" : "disabled"}>开始使用 Bipolaris</button>
      </div>
    </section>
  `
}

function card(title, desc) {
  return `<article class="card"><b>${title}</b><span>${desc}</span></article>`
}

function renderCheckin() {
  const steps = ["情绪", "睡眠与精力", "状态", "用药"]
  app.innerHTML = `
    <section class="screen">
      <header class="checkin-header">
        <div class="checkin-top">
          ${checkinStep > 0 ? '<button class="round-button" data-action="prev-step">‹</button>' : "<span></span>"}
          <span class="small">${checkinStep + 1} / ${steps.length}</span>
          <button class="ghost-button" style="width:auto;min-height:0" data-action="finish-checkin">跳过</button>
        </div>
        <div class="progress">${steps.map((_, index) => `<span class="${index <= checkinStep ? "active" : ""}"></span>`).join("")}</div>
      </header>
      <div class="scroll">${renderCheckinStep()}</div>
      <div class="bottom-action">
        <button class="primary-button" data-action="${checkinStep === 3 ? "finish-checkin" : "next-step"}">
          ${checkinStep === 3 ? "完成签到，开始对话" : "继续"}
        </button>
      </div>
    </section>
  `
}

function renderCheckinStep() {
  if (checkinStep === 0) {
    const labels = ["很糟糕", "比较差", "一般", "还不错", "很好"]
    return `
      <h2 class="screen-title">今天感觉怎么样？</h2>
      <p class="muted">选择最符合你当前情绪的选项</p>
      <div class="mood-grid">
        ${labels
          .map(
            (label, index) => `
              <button class="choice ${checkin.mood === index + 1 ? "active" : ""}" data-set="mood" data-value="${index + 1}">
                <strong>${index + 1}</strong>${label}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="card" style="margin-top:18px"><span>你选择了「${labels[checkin.mood - 1] || "一般"}」，我会在对话中记住这一点。</span></div>
    `
  }

  if (checkinStep === 1) {
    return `
      <h2 class="screen-title">睡眠与精力</h2>
      <p class="muted">1 = 很差，5 = 很好</p>
      ${scale("昨晚睡眠质量", "sleep", ["很差", "较差", "一般", "较好", "很好"])}
      ${scale("今日精力水平", "energy", ["极度疲惫", "比较疲惫", "一般", "比较充沛", "精力旺盛"])}
      ${scale("冲动程度", "impulse", ["非常平静", "较平静", "一般", "有些冲动", "非常冲动"])}
    `
  }

  if (checkinStep === 2) {
    const states = [
      ["stable", "平稳", "情绪比较稳定，没有明显波动"],
      ["depressed", "抑郁相", "情绪低落，动力不足，感到疲惫或绝望"],
      ["manic", "躁狂相", "精力过旺，思维快速，睡眠需求减少"],
      ["mixed", "混合状态", "同时存在抑郁与躁狂特征，感到矛盾"],
    ]
    return `
      <h2 class="screen-title">你觉得自己处于哪种状态？</h2>
      <p class="muted">这会帮助我们给你更合适的支持</p>
      <div class="state-grid">
        ${states
          .map(
            ([key, title, desc]) => `
              <button class="state-choice ${checkin.state === key ? "active" : ""}" data-set="state" data-value="${key}">
                <b>${title}</b><span>${desc}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <button class="secondary-button" style="margin-top:12px" data-set="state" data-value="unknown">不确定 / 说不清楚</button>
    `
  }

  const meds = [
    ["taken", "已按时服药", "今天已按医嘱完成"],
    ["partial", "部分服药", "有一部分没有完成"],
    ["missed", "忘记服药", "不确定是否需要补服时请咨询医生或药师"],
    ["none", "无需服药", "当前没有今日用药安排"],
  ]
  return `
    <h2 class="screen-title">今日用药情况</h2>
    <p class="muted">记录是否按时服药，帮助追踪依从性</p>
    <div class="med-grid">
      ${meds
        .map(
          ([key, title, desc]) => `
            <button class="med-choice ${checkin.medication === key ? "active" : ""}" data-set="medication" data-value="${key}">
              <b>${title}</b><span>${desc}</span>
            </button>
          `,
        )
        .join("")}
    </div>
    <textarea class="notes" data-notes placeholder="今天发生了什么，或者有什么特别的感受...">${escapeHtml(checkin.notes || "")}</textarea>
  `
}

function scale(title, key, labels) {
  return `
    <section class="scale-block">
      <div class="scale-title"><b>${title}</b><span class="muted">${labels[checkin[key] - 1] || "未选择"}</span></div>
      <div class="scale-row">
        ${[1, 2, 3, 4, 5]
          .map(
            (value) => `
              <button class="${checkin[key] === value ? "active" : ""}" data-set="${key}" data-value="${value}">${value}</button>
            `,
          )
          .join("")}
      </div>
    </section>
  `
}

function renderMain() {
  if (!messages.length) {
    messages = [
      {
        id: "welcome",
        role: "assistant",
        content: getGreeting(),
        risk: "low",
        strategy: "initial greeting",
      },
    ]
  }
  app.innerHTML = `
    <section class="screen app-main">
      <div class="tab-body">
        ${activeTab === "chat" ? renderChat() : activeTab === "report" ? renderReport() : renderSettings()}
      </div>
      <nav class="tab-bar">
        ${tabButton("chat", "对话")}
        ${tabButton("report", "记录")}
        ${tabButton("settings", "设置")}
      </nav>
    </section>
  `
  scrollToBottom(false)
}

function tabButton(key, label) {
  const icons = { chat: "○", report: "□", settings: "◇" }
  return `<button class="tab-button ${activeTab === key ? "active" : ""}" data-tab="${key}"><span>${icons[key]}</span><br />${label}</button>`
}

function renderChat() {
  const suggestions = getSuggestions()
  return `
    <section class="chat">
      <header class="chat-top">
        <div class="brand-mini">
          <div class="brand-dot">B</div>
          <div><b>Bipolaris</b><div class="small">AI 情绪支持</div></div>
        </div>
        <span class="state-tag">${stateLabels[checkin.state] || "未知"}</span>
      </header>
      <div class="messages" id="messages">
        ${showCrisis ? crisisBanner() : ""}
        ${messages.map(renderMessage).join("")}
        ${isTyping ? '<div class="message-row assistant"><div class="bubble">正在思考...</div></div>' : ""}
      </div>
      ${
        messages.length <= 1
          ? `<section class="suggestions"><p>你也可以直接点击话题开始：</p><div class="chip-row">${suggestions
              .map((item) => `<button class="chip" data-send="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
              .join("")}</div></section>`
          : ""
      }
      <section class="composer-wrap">
        <form class="composer" id="chatForm">
          <textarea id="chatInput" rows="1" placeholder="说说你现在的感受..."></textarea>
          <button class="send" type="submit" aria-label="发送">→</button>
        </form>
        <p class="fine-print">AI 不替代医疗 · 危机请拨 120 或 400-161-9995</p>
      </section>
    </section>
  `
}

function renderMessage(message) {
  const risk = message.role === "assistant" && message.risk && message.risk !== "low"
    ? `<span class="risk-tag">${message.risk === "crisis" ? "危机" : "中风险"}</span>`
    : ""
  const feedback =
    message.role === "assistant"
      ? `<div class="meta-line"><span class="small">${risk || "Bipolaris"}</span><div class="feedback"><button data-feedback="helpful" data-id="${message.id}" aria-label="有帮助">♡</button><button data-feedback="not_helpful" data-id="${message.id}" aria-label="无帮助">×</button></div></div>`
      : ""
  return `
    <article class="message-row ${message.role}">
      <div class="bubble">${escapeHtml(message.content)}${feedback}</div>
    </article>
  `
}

function crisisBanner() {
  return `
    <section class="crisis-banner">
      <b>紧急支持</b>
      <span>如果你可能伤害自己或他人，请立即联系真实的人和专业服务。</span>
      <a href="tel:4001619995">希望24热线 400-161-9995</a>
      <a href="tel:120">急救电话 120</a>
    </section>
  `
}

function getGreeting() {
  const hour = new Date().getHours()
  const greet = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"
  const map = {
    depressed: `${greet}。我看到你今天情绪比较低落，不需要勉强振作，我就陪着你。\n\n想聊聊今天发生了什么吗？`,
    manic: `${greet}。我注意到你现在精力比较旺盛，这种感觉有时候很好，但也值得我们一起留意一下。\n\n你现在最想做什么？`,
    mixed: `${greet}。混合状态真的很难受，既疲惫又停不下来。我在这里，我们慢慢聊。\n\n现在最让你困扰的是什么？`,
    stable: `${greet}！很高兴看到你今天状态比较平稳。\n\n有什么想聊的吗，或者只是想打个招呼也好。`,
    unknown: `${greet}。很高兴你来找我，不管现在是什么心情，我都愿意听。\n\n今天有什么在你心里转？`,
  }
  return map[checkin.state] || map.unknown
}

function getSuggestions() {
  const map = {
    depressed: ["我最近一直很累，不想做任何事", "我不知道为什么就是难受", "我觉得自己给别人添麻烦了"],
    manic: ["我有好多计划想做", "我最近睡得很少但不觉得困", "我有点停不下来"],
    mixed: ["我说不清楚我现在什么感觉", "我既想哭又很烦躁", "我感觉自己快撑不住了"],
    stable: ["我想记录一下今天的状态", "我最近有一些预警信号想确认", "我下周要复诊，想聊聊准备什么"],
    unknown: ["我今天感觉有点不对", "我想聊聊最近的睡眠", "我不知道从哪里开始说"],
  }
  return map[checkin.state] || map.unknown
}

function renderReport() {
  const logs = readJson(STORAGE.logs, [])
  const avgMood = logs.length ? (logs.reduce((sum, item) => sum + item.mood, 0) / logs.length).toFixed(1) : "-"
  return `
    <section class="panel-screen">
      <h2 class="screen-title">状态记录</h2>
      <p class="muted">这些记录保存在你的浏览器里，可用于复诊前回顾。</p>
      <div class="report-stat">
        <div class="stat-card"><strong>${logs.length}</strong><span class="small">记录数</span></div>
        <div class="stat-card"><strong>${avgMood}</strong><span class="small">平均情绪</span></div>
        <div class="stat-card"><strong>${stateLabels[checkin.state] || "未知"}</strong><span class="small">当前状态</span></div>
      </div>
      ${logs.length ? logs.map(renderLogItem).join("") : '<div class="empty">还没有记录。完成一次签到后，这里会显示你的状态历史。</div>'}
    </section>
  `
}

function renderLogItem(item) {
  return `
    <article class="log-item">
      <b>${new Date(item.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>
      <span class="small">情绪 ${item.mood} · 睡眠 ${item.sleep} · 精力 ${item.energy} · 冲动 ${item.impulse}</span>
      <span class="small">${stateLabels[item.state] || "未知"} · ${medicationLabels[item.medication] || "未记录"}</span>
      ${item.notes ? `<span class="small">${escapeHtml(item.notes)}</span>` : ""}
    </article>
  `
}

function renderSettings() {
  return `
    <section class="panel-screen">
      <h2 class="screen-title">设置</h2>
      <div class="stack">
        ${card("产品边界", "Bipolaris 不能诊断疾病、开药或调整剂量。关于治疗和用药，请咨询精神科医生或药师。")}
        ${card("危机资源", "希望24热线：400-161-9995。紧急情况请立即拨打 120。")}
        ${card("后端状态", `当前连接：${API_BASE_URL}`)}
        <button class="secondary-button" data-action="restart-checkin">重新签到</button>
        <button class="secondary-button" data-action="clear-local">清除本机记录</button>
      </div>
    </section>
  `
}

function finishCheckin() {
  checkin.notes = document.querySelector("[data-notes]")?.value || checkin.notes || ""
  writeJson(STORAGE.checkin, checkin)
  const logs = readJson(STORAGE.logs, [])
  logs.unshift({ ...checkin, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
  writeJson(STORAGE.logs, logs.slice(0, 30))
  setPhase("main")
}

function checkinToBackendState() {
  return {
    mood_state: checkin.state === "unknown" ? "stable" : checkin.state,
    sleep: checkin.sleep * 2,
    energy: checkin.energy * 2,
    impulsivity: checkin.impulse * 2,
    medication_schedule:
      checkin.medication === "taken"
        ? ["今日已按医嘱服药"]
        : checkin.medication === "missed"
          ? ["今日可能漏服"]
          : checkin.medication === "partial"
            ? ["今日部分服药"]
            : [],
    completed_routines: [],
    warning_signs: warningSignsFromCheckin(),
    emergency_contact: null,
  }
}

function warningSignsFromCheckin() {
  const signs = []
  if (checkin.sleep <= 2 && checkin.energy >= 4) signs.push("睡眠减少但精力充沛")
  if (checkin.impulse >= 4) signs.push("冲动消费或冒险")
  if (checkin.mood <= 2) signs.push("自我评价很低或无望感")
  return signs
}

function detectLocalRisk(text) {
  if (/(自杀|结束生命|不想活|去死|自残|割腕|伤害自己|药物过量|了结自己|活着没意义)/.test(text)) return "crisis"
  if (/(崩溃|受不了|放弃|消失|很痛苦|绝望|砸东西|控制不住)/.test(text)) return "medium"
  return "low"
}

async function sendMessage(text) {
  const trimmed = text.trim()
  if (!trimmed || isTyping) return
  const localRisk = detectLocalRisk(trimmed)
  showCrisis = showCrisis || localRisk === "crisis"
  messages.push({ id: crypto.randomUUID(), role: "user", content: trimmed, risk: localRisk })
  isTyping = true
  renderMain()

  try {
    const history = messages
      .filter((item) => item.role === "user" || item.role === "assistant")
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimmed,
        state: checkinToBackendState(),
        history,
      }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    showCrisis = showCrisis || data.risk_level === "crisis"
    messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content: data.reply,
      risk: data.risk_level,
      strategy: data.selected_strategy,
    })
  } catch {
    messages.push({
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "我这边暂时连接后端失败，但我仍然听到你了。请先把注意力放回此刻：喝一口水，坐稳，慢慢呼吸三次。如果你有伤害自己或他人的想法，请立即拨打 120 或希望24热线 400-161-9995。",
      risk: localRisk,
      strategy: "offline fallback",
    })
  } finally {
    isTyping = false
    renderMain()
  }
}

async function sendFeedback(id, label) {
  const message = messages.find((item) => item.id === id)
  if (!message) return
  await fetch(`${API_BASE_URL}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_id: `${getAnonymousUserId()}:${id}`,
      label,
      rating: label === "helpful" ? 5 : 2,
      risk_level: message.risk,
      selected_strategy: message.strategy,
    }),
  }).catch(() => {})
}

function scrollToBottom(smooth = true) {
  requestAnimationFrame(() => {
    const list = document.querySelector("#messages")
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: smooth ? "smooth" : "auto" })
  })
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button,input")
  if (!target) return

  const action = target.dataset.action
  if (action === "go-disclaimer") setPhase("disclaimer")
  if (action === "toggle-agree") {
    agreed = target.checked
    renderDisclaimer()
  }
  if (action === "start-checkin") setPhase("checkin")
  if (action === "prev-step") {
    checkinStep = Math.max(0, checkinStep - 1)
    renderCheckin()
  }
  if (action === "next-step") {
    checkin.notes = document.querySelector("[data-notes]")?.value || checkin.notes || ""
    checkinStep = Math.min(3, checkinStep + 1)
    renderCheckin()
  }
  if (action === "finish-checkin") finishCheckin()
  if (action === "restart-checkin") {
    checkinStep = 0
    setPhase("checkin")
  }
  if (action === "clear-local") {
    localStorage.removeItem(STORAGE.logs)
    localStorage.removeItem(STORAGE.checkin)
    localStorage.removeItem(STORAGE.phase)
    phase = "welcome"
    checkin = { ...defaultCheckin }
    messages = []
    render()
  }

  if (target.dataset.set) {
    checkin[target.dataset.set] = Number.isNaN(Number(target.dataset.value))
      ? target.dataset.value
      : Number(target.dataset.value)
    renderCheckin()
  }

  if (target.dataset.tab) {
    activeTab = target.dataset.tab
    renderMain()
  }

  if (target.dataset.send) sendMessage(target.dataset.send)
  if (target.dataset.feedback) sendFeedback(target.dataset.id, target.dataset.feedback)
})

document.addEventListener("submit", (event) => {
  if (event.target.id !== "chatForm") return
  event.preventDefault()
  const input = document.querySelector("#chatInput")
  sendMessage(input.value)
  input.value = ""
})

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-notes]")) checkin.notes = event.target.value
  if (event.target.id === "chatInput") {
    event.target.style.height = "auto"
    event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`
  }
})

document.addEventListener("keydown", (event) => {
  if (event.target.id === "chatInput" && event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    const input = event.target
    sendMessage(input.value)
    input.value = ""
  }
})

render()
