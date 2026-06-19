"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Loader2, Phone, Send, ThumbsDown, ThumbsUp } from "lucide-react"
import type { CheckinData } from "./checkin-screen"
import { requestChatReply, submitFeedback, type BackendRisk, type ChatHistoryMessage } from "@/lib/bipolaris-api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  risk?: BackendRisk | "none"
  state?: string
  selectedStrategy?: string
  timestamp: Date
}

interface ChatScreenProps {
  checkinData: CheckinData
}

function CrisisBanner() {
  return (
    <div className="mx-4 mb-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="mb-2 text-sm font-medium text-destructive">紧急支持</p>
          <div className="space-y-1.5">
            <a href="tel:4001619995" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Phone className="h-4 w-4" />希望24热线 400-161-9995
            </a>
            <a href="tel:120" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Phone className="h-4 w-4" />急救电话 120
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
  const item = config[state] || config.unknown
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.cls}`}>{item.label}</span>
}

function RiskBadge({ risk }: { risk?: string }) {
  if (!risk || risk === "none") return null
  const config: Record<string, { label: string; cls: string }> = {
    low: { label: "低风险", cls: "bg-yellow-100 text-yellow-700" },
    medium: { label: "中风险", cls: "bg-orange-100 text-orange-700" },
    crisis: { label: "危机", cls: "bg-red-100 text-red-700" },
  }
  const item = config[risk]
  if (!item) return null
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.cls}`}>{item.label}</span>
}

function getGreeting(data: CheckinData): string {
  const hour = new Date().getHours()
  const greet = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"
  const stateGreets: Record<string, string> = {
    depressed: `${greet}。我看到你今天情绪比较低落，不需要勉强振作，我就陪着你。\n\n想聊聊今天发生了什么吗？`,
    manic: `${greet}。我注意到你现在精力比较旺盛，这种感觉有时候很好，但也值得我们一起留意一下。\n\n你现在最想做什么？`,
    mixed: `${greet}。混合状态真的很难受，既疲惫又停不下来。我在这里，我们慢慢聊。\n\n现在最让你困扰的是什么？`,
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

function fallbackReply() {
  return "后端暂时没有回应，但我还在这里。你可以先把当前状态降到一个很小的动作：喝几口水、坐稳、把刺激源放远一点。如果你有伤害自己或他人的想法，请马上拨打 120 或希望24热线 400-161-9995。"
}

export function ChatScreen({ checkinData }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: getGreeting(checkinData), risk: "none", state: checkinData.state, timestamp: new Date() },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim(), risk: "none", timestamp: new Date() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setIsTyping(true)

    const history: ChatHistoryMessage[] = nextMessages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }))

    try {
      const data = await requestChatReply(text.trim(), checkinData, history)
      if (data.risk_level === "crisis") setShowCrisis(true)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          risk: data.risk_level,
          state: String(data.context_payload.inferred_bd_state || checkinData.state),
          selectedStrategy: data.selected_strategy,
          timestamp: new Date(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: fallbackReply(), risk: "medium", state: checkinData.state, timestamp: new Date() },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  async function handleFeedback(message: Message, label: "helpful" | "not_helpful" | "unsafe" | "too_generic") {
    setFeedbackByMessage((prev) => ({ ...prev, [message.id]: label }))
    await submitFeedback({
      messageId: message.id,
      label,
      rating: label === "helpful" ? 5 : label === "not_helpful" ? 2 : 1,
      riskLevel: message.risk,
      bdState: message.state,
      selectedStrategy: message.selectedStrategy,
    }).catch(() => undefined)
  }

  const suggestions = getSuggestions(checkinData)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <svg fill="none" height="16" viewBox="0 0 32 32" width="16">
              <path d="M16 4C16 4 8 10 8 18C8 22.4183 11.5817 26 16 26C20.4183 26 24 22.4183 24 18C24 10 16 4 16 4Z" fill="white" fillOpacity="0.9" />
              <circle cx="16" cy="18" fill="white" fillOpacity="0.5" r="4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium leading-none text-foreground">Bipolaris</p>
            <p className="text-xs text-muted-foreground">AI 情绪支持</p>
          </div>
        </div>
        <StateTag state={checkinData.state} />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto py-4">
        {showCrisis && <CrisisBanner />}
        {messages.map((message) => (
          <div key={message.id} className={`px-4 ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
            <div className={`max-w-[85%] ${message.role === "user" ? "rounded-3xl rounded-tr-lg bg-primary px-4 py-3 text-primary-foreground" : "rounded-3xl rounded-tl-lg border border-border bg-card px-4 py-3"}`}>
              {message.role === "assistant" && message.risk && message.risk !== "none" && (
                <div className="mb-2 flex items-center gap-1.5">
                  <RiskBadge risk={message.risk} />
                </div>
              )}
              <p className="whitespace-pre-line text-sm leading-relaxed">{message.content}</p>
              {message.role === "assistant" && (
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                  <span className="text-xs text-muted-foreground">{message.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="flex gap-1">
                    <button aria-label="有帮助" onClick={() => handleFeedback(message, "helpful")} className={`flex h-6 w-6 items-center justify-center rounded-full ${feedbackByMessage[message.id] === "helpful" ? "bg-green-100 text-green-700" : "text-muted-foreground"}`}>
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="没帮助" onClick={() => handleFeedback(message, "not_helpful")} className={`flex h-6 w-6 items-center justify-center rounded-full ${feedbackByMessage[message.id] === "not_helpful" ? "bg-amber-100 text-amber-700" : "text-muted-foreground"}`}>
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleFeedback(message, "unsafe")} className={`rounded-full px-2 text-[11px] ${feedbackByMessage[message.id] === "unsafe" ? "bg-red-100 text-red-700" : "text-muted-foreground"}`}>不安全</button>
                    <button onClick={() => handleFeedback(message, "too_generic")} className={`rounded-full px-2 text-[11px] ${feedbackByMessage[message.id] === "too_generic" ? "bg-blue-100 text-blue-700" : "text-muted-foreground"}`}>太泛</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start px-4">
            <div className="flex items-center gap-2 rounded-3xl rounded-tl-lg border border-border bg-card px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">正在思考...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="mb-2 px-1 text-xs text-muted-foreground">你也可以直接点击话题开始：</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button key={suggestion} onClick={() => sendMessage(suggestion)} className="rounded-full border border-border bg-accent px-3 py-2 text-xs text-accent-foreground transition-transform active:scale-95">
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border bg-background px-4 pb-4 pt-2">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="说说你现在的感受..."
            rows={1}
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 ${input.trim() && !isTyping ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">AI 不替代医疗 · 危机请拨 120 或 400-161-9995</p>
      </div>
    </div>
  )
}
