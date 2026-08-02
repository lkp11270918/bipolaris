"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, ThumbsUp, ThumbsDown, X } from "lucide-react"
import type { CheckinData } from "./checkin-screen"
import {
  requestChatReply,
  getUserSettings,
  getMoodLogs,
  submitFeedback,
  trackEvent,
  type BackendRisk,
  type ChatHistoryMessage,
} from "@/lib/bipolaris-api"
import { CrisisSupportMode } from "@/components/crisis-support-mode"
import { buildPersonalTrendMessage, getRecordingEncouragement } from "@/lib/personal-insights"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  risk?: "none" | BackendRisk
  state?: string
  strategy?: string
  ragSources?: string[]
  usedOpenAI?: boolean
  timestamp: Date
}

interface ChatScreenProps {
  checkinData: CheckinData
}

// 危机关键词检测（演示用）
function detectRisk(text: string): "none" | "low" | "medium" | "crisis" {
  const crisisWords = [
    "自杀", "结束生命", "不想活", "去死", "自残", "割腕", "伤害自己", "伤害他人",
    "药物过量", "吞药", "跳楼", "跳下去", "楼顶", "天台", "铁轨", "刀在手里",
  ]
  const mediumWords = ["崩溃", "受不了", "放弃", "消失", "很痛苦", "绝望"]
  const lowWords = ["难受", "低落", "焦虑", "担心", "睡不着"]
  const t = text.toLowerCase()
  if (crisisWords.some((w) => t.includes(w))) return "crisis"
  if (mediumWords.some((w) => t.includes(w))) return "medium"
  if (lowWords.some((w) => t.includes(w))) return "low"
  return "none"
}

function StateTag({ state }: { state: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    stable: { label: "平稳", cls: "bg-green-100 text-green-700" },
    depressed: { label: "抑郁相", cls: "bg-blue-100 text-blue-700" },
    manic: { label: "躁狂相", cls: "bg-amber-100 text-amber-700" },
    mixed: { label: "混合", cls: "bg-orange-100 text-orange-700" },
    unknown: { label: "未知", cls: "bg-muted text-muted-foreground" },
  }
  const c = config[state] || config.unknown
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === "none" || !risk) return null
  const config: Record<string, { label: string; cls: string }> = {
    low: { label: "低风险", cls: "bg-yellow-100 text-yellow-700" },
    medium: { label: "中风险", cls: "bg-orange-100 text-orange-700" },
    high: { label: "高风险", cls: "bg-red-100 text-red-700" },
    imminent: { label: "即时危险", cls: "bg-red-200 text-red-900" },
    crisis: { label: "危机", cls: "bg-red-100 text-red-700" },
  }
  const c = config[risk]
  if (!c) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}>
      {c.label}
    </span>
  )
}

export function ChatScreen({ checkinData }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: getGreeting(checkinData),
      risk: "none",
      state: checkinData.state,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const risk = detectRisk(trimmed)
    if (["high", "imminent", "crisis"].includes(risk)) setShowCrisis(true)

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      risk,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    try {
      const history: ChatHistoryMessage[] = [...messages, userMsg]
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .slice(-40)
        .map((msg) => ({ role: msg.role, content: msg.content }))
      const data = await requestChatReply(trimmed, checkinData, history)
      if (["high", "imminent", "crisis"].includes(data.risk_level)) setShowCrisis(true)
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        risk: data.risk_level,
        state: String(data.context_payload?.inferred_bd_state || checkinData.state),
        strategy: data.selected_strategy,
        ragSources: ((data.context_payload?.retrieved_examples as Array<{ source?: string }> | undefined) || [])
          .map((item) => item.source || "")
          .filter(Boolean),
        usedOpenAI: data.used_openai,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const isCrisis = risk === "crisis"
      if (isCrisis) setShowCrisis(true)
      trackEvent("chat_error", { stage: "request_chat_reply", local_risk: risk, checkin_state: checkinData.state })
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: isCrisis
          ? "我很在意你现在的安全。请先远离可能造成伤害的地点或物品，并立即联系一个能来到你身边的人。请拨打 120 或希望24热线 400-161-9995，优先让现实中的支持马上介入。"
          : "刚才的回复没有成功生成。请稍后重新发送一次；你已经输入的内容仍保留在本次对话中。",
        risk,
        state: checkinData.state,
        strategy: isCrisis ? "offline crisis fallback" : "connection retry",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } finally {
      setIsTyping(false)
    }
  }

  function handleSend() {
    void sendText(input)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFeedback(msg: Message, label: "helpful" | "not_helpful") {
    if (label === "not_helpful") {
      setFeedbackMessage(msg)
      return
    }
    void submitFeedback({
      messageId: msg.id,
      label,
      rating: label === "helpful" ? 5 : 2,
      riskLevel: msg.risk,
      bdState: msg.state,
      selectedStrategy: msg.strategy,
    })
  }

  function submitNegativeFeedback(label: "not_understood" | "too_generic" | "not_actionable" | "uncomfortable" | "unsafe") {
    if (!feedbackMessage) return
    const index = messages.findIndex((message) => message.id === feedbackMessage.id)
    const previousUserMessage = [...messages.slice(0, index)].reverse().find((message) => message.role === "user")
    void submitFeedback({
      messageId: feedbackMessage.id,
      label,
      rating: label === "unsafe" ? 1 : 2,
      riskLevel: feedbackMessage.risk,
      bdState: feedbackMessage.state,
      selectedStrategy: feedbackMessage.strategy,
      userMessage: previousUserMessage?.content,
      assistantReply: feedbackMessage.content,
      ragSources: feedbackMessage.ragSources,
      usedOpenAI: feedbackMessage.usedOpenAI,
    })
    setFeedbackMessage(null)
  }

  // 快捷话题
  const suggestions = getSuggestions(checkinData)

  return (
    <div className="flex flex-col h-full bg-background" style={{ minHeight: 0 }}>
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C16 4 8 10 8 18C8 22.4183 11.5817 26 16 26C20.4183 26 24 22.4183 24 18C24 10 16 4 16 4Z" fill="white" fillOpacity="0.9" />
              <circle cx="16" cy="18" r="4" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground leading-none">Bipolaris</p>
            <p className="text-xs text-muted-foreground">AI 情绪支持</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StateTag state={checkinData.state} />
        </div>
      </div>

      {/* 消息列表 */}
      {showCrisis ? (
        <div className="flex-1 min-h-0">
          <CrisisSupportMode
            onReturnToChat={() => {
              setShowCrisis(false)
              trackEvent("crisis_mode_closed")
            }}
          />
        </div>
      ) : (
      <>
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`px-4 ${msg.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
            <div
              className={`max-w-[85%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-3xl rounded-tr-lg px-4 py-3"
                  : "bg-card border border-border rounded-3xl rounded-tl-lg px-4 py-3"
              }`}
            >
              {msg.role === "assistant" && msg.risk && msg.risk !== "none" && (
                <div className="flex items-center gap-1.5 mb-2">
                  <RiskBadge risk={msg.risk} />
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
              {msg.role === "assistant" && isMedicationRelated(messages, index) && (
                <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-800 leading-relaxed">用药决定请遵医嘱。不要自行停药、加减药或补服；不确定时请联系开药医生或药师。</p>
                </div>
              )}
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex gap-1">
                    <button
                      aria-label="这条回复有帮助"
                      onClick={() => handleFeedback(msg, "helpful")}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      aria-label="这条回复没有帮助"
                      onClick={() => handleFeedback(msg, "not_helpful")}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="px-4 flex justify-start">
            <div className="bg-card border border-border rounded-3xl rounded-tl-lg px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              <span className="text-sm text-muted-foreground">正在思考…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 快捷话题（仅第一次显示） */}
      {messages.length <= 1 && suggestions.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2 px-1">你也可以直接点击话题开始：</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendText(s)}
                className="text-xs bg-accent text-accent-foreground px-3 py-2 rounded-full border border-border active:scale-95 transition-transform"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* 输入框 */}
      {!showCrisis && (
      <div className="px-4 pb-4 pt-2 bg-background border-t border-border">
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说说你现在的感受…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed py-1.5 max-h-28"
            style={{ minHeight: "36px" }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 112) + "px"
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
              input.trim() && !isTyping
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-2 leading-relaxed">
          你的对话会被加密保护，仅用于提供本次支持体验。
          <br />
          AI 不替代医疗 · 危机请拨 120 或 400-161-9995
        </p>
      </div>
      )}

      {feedbackMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setFeedbackMessage(null)}>
          <div className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-foreground">哪里没有帮到你？</h3>
              <button aria-label="关闭" onClick={() => setFeedbackMessage(null)} className="w-8 h-8 flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">提交后，这一轮输入和回复会用于定位问题，不会公开展示。</p>
            <div className="space-y-2">
              {[
                ["not_understood", "没有理解我的意思"],
                ["too_generic", "回复太空泛"],
                ["not_actionable", "建议对我没用"],
                ["uncomfortable", "这让我感到不舒服"],
                ["unsafe", "可能存在安全风险"],
              ].map(([value, label]) => (
                <button key={value} onClick={() => submitNegativeFeedback(value as Parameters<typeof submitNegativeFeedback>[0])} className="w-full py-3.5 px-4 rounded-2xl bg-background border border-border text-sm text-left text-foreground">{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function isMedicationRelated(messages: Message[], index: number): boolean {
  const terms = ["用药", "服药", "漏服", "补服", "停药", "加药", "减药", "剂量", "药物", "副作用"]
  const current = messages[index]?.content || ""
  const previous = index > 0 && messages[index - 1]?.role === "user" ? messages[index - 1].content : ""
  return terms.some((term) => current.includes(term) || previous.includes(term))
}

function getGreeting(data: CheckinData): string {
  const hour = new Date().getHours()
  const greet = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"

  const stateGreets: Record<string, string> = {
    depressed: `${greet}。我看到你今天情绪比较低落，不需要勉强振作，我就陪着你。\n\n想聊聊今天发生了什么吗？`,
    manic: `${greet}。我注意到你现在精力比较旺盛，这种感觉有时候很好，但也值得我们一起留意一下。\n\n你现在最想做什么？`,
    mixed: `${greet}。混合状态真的很难受——既疲惫又停不下来。我在这里，我们慢慢聊。\n\n现在最让你困扰的是什么？`,
    stable: `${greet}！很高兴看到你今天状态比较平稳。\n\n有什么想聊的吗，或者只是想打个招呼也好。`,
    unknown: `${greet}。很高兴你来找我，不管现在是什么心情，我都愿意听。\n\n今天有什么在你心里转？`,
  }

  const settings = getUserSettings()
  const logs = getMoodLogs()
  const focus = settings.supportGoals.includes("followup")
    ? "我也会帮你把值得复诊时说明的变化整理下来。"
    : settings.supportGoals.includes("warning_signs")
      ? "我会结合你的近期记录，留意和平时不同的变化。"
      : ""
  const stageFocus = settings.userStage === "newly_diagnosed"
    ? "刚开始适应诊断和长期管理并不容易，我们一次只整理一个最重要的问题。"
    : settings.userStage === "stable_management"
      ? "状态平稳时留下自己的基线，也能帮助以后更早看见变化。"
      : ""
  const trend = buildPersonalTrendMessage(data, logs)
  const encouragement = getRecordingEncouragement(logs)
  return [stateGreets[data.state] || stateGreets.unknown, focus, stageFocus, trend, encouragement].filter(Boolean).join("\n\n")
}

function getSuggestions(data: CheckinData): string[] {
  const base: Record<string, string[]> = {
    depressed: ["我最近一直很累，不想做任何事", "我不知道为什么就是难受", "我觉得自己给别人添麻烦了"],
    manic: ["我有好多计划想做", "我最近睡得很少但不觉得困", "我有点停不下来"],
    mixed: ["我说不清楚我现在什么感觉", "我既想哭又很烦躁", "我感觉自己快撑不住了"],
    stable: ["我想记录一下今天的状态", "我最近有一些预警信号想确认", "我下周要复诊，想聊聊准备什么"],
    unknown: ["我今天感觉有点不对", "我想聊聊最近的睡眠", "我不知道从哪里开始说"],
  }
  const settings = getUserSettings()
  const goalSuggestion = settings.supportGoals.includes("followup")
    ? "帮我看看最近有哪些变化值得复诊时说"
    : settings.supportGoals.includes("warning_signs")
      ? "帮我对比一下最近和平时有什么不同"
      : settings.supportGoals.includes("impulse_control")
        ? "我有个冲动决定，想先一起缓一缓"
        : ""
  const stageSuggestion = settings.userStage === "newly_diagnosed"
    ? "我刚确诊，不知道该怎么适应"
    : settings.userStage === "stable_management"
      ? "帮我整理一份自己的稳定基线"
      : ""
  return Array.from(new Set([goalSuggestion, stageSuggestion, ...(base[data.state] || base.unknown)].filter(Boolean))).slice(0, 3)
}
