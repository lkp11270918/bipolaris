"use client"

import { useState, useRef, useEffect } from "react"
import { Send, AlertTriangle, Phone, Loader2, ThumbsUp, ThumbsDown } from "lucide-react"
import type { CheckinData } from "./checkin-screen"
import { requestChatReply, submitFeedback, type ChatHistoryMessage } from "@/lib/bipolaris-api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  risk?: "none" | "low" | "medium" | "crisis"
  state?: string
  strategy?: string
  timestamp: Date
}

interface ChatScreenProps {
  checkinData: CheckinData
}

// 危机关键词检测（演示用）
function detectRisk(text: string): "none" | "low" | "medium" | "crisis" {
  const crisisWords = ["自杀", "结束生命", "不想活", "去死", "自残", "割", "伤害自己", "药物过量"]
  const mediumWords = ["崩溃", "受不了", "放弃", "消失", "很痛苦", "绝望"]
  const lowWords = ["难受", "低落", "焦虑", "担心", "睡不着"]
  const t = text.toLowerCase()
  if (crisisWords.some((w) => t.includes(w))) return "crisis"
  if (mediumWords.some((w) => t.includes(w))) return "medium"
  if (lowWords.some((w) => t.includes(w))) return "low"
  return "none"
}

function CrisisBanner() {
  return (
    <div className="mx-4 mb-3 bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive mb-2">紧急支持</p>
          <div className="space-y-1.5">
            <a
              href="tel:4001619995"
              className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2"
            >
              <Phone className="w-4 h-4" />
              希望24热线 400-161-9995
            </a>
            <a
              href="tel:120"
              className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2"
            >
              <Phone className="w-4 h-4" />
              急救电话 120
            </a>
          </div>
        </div>
      </div>
    </div>
  )
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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const risk = detectRisk(trimmed)
    if (risk === "crisis") setShowCrisis(true)

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
        .slice(-8)
        .map((msg) => ({ role: msg.role, content: msg.content }))
      const data = await requestChatReply(trimmed, checkinData, history)
      if (data.risk_level === "crisis") setShowCrisis(true)
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        risk: data.risk_level,
        state: checkinData.state,
        strategy: data.selected_strategy,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "我这边暂时连接后端失败，但我仍然听到你了。请先把注意力放回此刻：喝一口水，坐稳，慢慢呼吸三次。如果你有伤害自己或他人的想法，请立即拨打 120 或希望24热线 400-161-9995。",
        risk,
        state: checkinData.state,
        strategy: "offline fallback",
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
    void submitFeedback({
      messageId: msg.id,
      label,
      rating: label === "helpful" ? 5 : 2,
      riskLevel: msg.risk,
      bdState: msg.state,
      selectedStrategy: msg.strategy,
    })
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
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {showCrisis && <CrisisBanner />}

        {messages.map((msg) => (
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
              {msg.role === "assistant" && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleFeedback(msg, "helpful")}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
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

      {/* 输入框 */}
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
    </div>
  )
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

  return stateGreets[data.state] || stateGreets.unknown
}

function getSuggestions(data: CheckinData): string[] {
  const base: Record<string, string[]> = {
    depressed: ["我最近一直很累，不想做任何事", "我不知道为什么就是难受", "我觉得自己给别人添麻烦了"],
    manic: ["我有好多计划想做", "我最近睡得很少但不觉得困", "我有点停不下来"],
    mixed: ["我说不清楚我现在什么感觉", "我既想哭又很烦躁", "我感觉自己快撑不住了"],
    stable: ["我想记录一下今天的状态", "我最近有一些预警信号想确认", "我下周要复诊，想聊聊准备什么"],
    unknown: ["我今天感觉有点不对", "我想聊聊最近的睡眠", "我不知道从哪里开始说"],
  }
  return base[data.state] || base.unknown
}
