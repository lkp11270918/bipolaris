"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Download,
  KeyRound,
  Loader2,
  MessageCircle,
  RefreshCw,
  Shield,
  UserCheck,
} from "lucide-react"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "https://bipolaris-api.onrender.com"

interface MetricsResponse {
  window_days: number
  total_events: number
  active_users: number
  active_sessions: number
  funnel: Record<string, number>
  engagement: Record<string, number>
  safety: Record<string, number>
  model_quality: Record<string, number>
  settings: Record<string, number>
  raw_event_counts: Record<string, number>
}

function formatNumber(value: number | undefined, suffix = "") {
  if (value === undefined || Number.isNaN(value)) return `0${suffix}`
  return `${Number(value).toLocaleString("zh-CN")}${suffix}`
}

function MetricCard({
  title,
  value,
  sub,
  tone = "default",
  Icon,
}: {
  title: string
  value: string
  sub: string
  tone?: "default" | "safety" | "model" | "privacy"
  Icon: typeof Activity
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    safety: "bg-destructive/10 text-destructive",
    model: "bg-blue-50 text-blue-600",
    privacy: "bg-emerald-50 text-emerald-700",
  }[tone]

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-2">{title}</p>
          <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function AdminPage() {
  const [days, setDays] = useState(7)
  const [token, setToken] = useState("")
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function loadMetrics(nextDays = days) {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ days: String(nextDays) })
      if (token.trim()) params.set("token", token.trim())
      const response = await fetch(`${API_BASE_URL}/admin/metrics?${params.toString()}`)
      if (!response.ok) {
        if (response.status === 403) throw new Error("Token 不正确，或者 Render 上配置了 ADMIN_METRICS_TOKEN。")
        throw new Error(`后端返回 ${response.status}`)
      }
      setMetrics((await response.json()) as MetricsResponse)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "读取指标失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMetrics(7)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxFunnel = useMemo(() => metrics?.funnel.app_opened || 0, [metrics])

  return (
    <main className="min-h-dvh bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm font-medium">BiPolaris Admin</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              产品数据看板
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              查看最近 {metrics?.window_days ?? days} 天的转化、互动、安全和模型指标。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex bg-card border border-border rounded-2xl p-1">
              {[7, 30, 90].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setDays(item)
                    void loadMetrics(item)
                  }}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    days === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item}天
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Admin token"
                className="w-32 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                type="password"
              />
            </div>
            <button
              onClick={() => void loadMetrics(days)}
              disabled={loading}
              className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              刷新
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!metrics && !error && (
          <div className="bg-card border border-border rounded-2xl p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            正在读取数据…
          </div>
        )}

        {metrics && (
          <div className="space-y-7">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="活跃用户"
                value={formatNumber(metrics.active_users)}
                sub={`${formatNumber(metrics.active_sessions)} 个会话，${formatNumber(metrics.total_events)} 个事件`}
                Icon={UserCheck}
              />
              <MetricCard
                title="首次对话转化"
                value={formatNumber(metrics.funnel.first_chat_conversion_rate, "%")}
                sub={`${formatNumber(metrics.funnel.chat_started)} 次开始聊天`}
                Icon={MessageCircle}
              />
              <MetricCard
                title="危机触发"
                value={formatNumber(metrics.safety.crisis_override_triggered)}
                sub={`热线点击率 ${formatNumber(metrics.safety.hotline_click_rate_after_crisis, "%")}`}
                tone="safety"
                Icon={AlertTriangle}
              />
              <MetricCard
                title="RAG 命中率"
                value={formatNumber(metrics.model_quality.rag_hit_rate, "%")}
                sub={`平均响应 ${formatNumber(metrics.model_quality.average_response_time_ms)} ms`}
                tone="model"
                Icon={Brain}
              />
            </div>

            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
              <Section title="转化漏斗">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <FunnelBar label="打开网页" value={metrics.funnel.app_opened || 0} max={maxFunnel} />
                  <FunnelBar
                    label="同意隐私说明"
                    value={metrics.funnel.privacy_notice_confirmed || 0}
                    max={maxFunnel}
                  />
                  <FunnelBar
                    label="完成签到"
                    value={metrics.funnel.checkin_completed || 0}
                    max={maxFunnel}
                  />
                  <FunnelBar
                    label="开始聊天"
                    value={metrics.funnel.chat_started || 0}
                    max={maxFunnel}
                  />
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-muted/60 rounded-2xl p-3">
                      <p className="text-xs text-muted-foreground">签到完成率</p>
                      <p className="text-lg font-semibold mt-1">
                        {formatNumber(metrics.funnel.checkin_completion_rate, "%")}
                      </p>
                    </div>
                    <div className="bg-muted/60 rounded-2xl p-3">
                      <p className="text-xs text-muted-foreground">首次聊天转化</p>
                      <p className="text-lg font-semibold mt-1">
                        {formatNumber(metrics.funnel.first_chat_conversion_rate, "%")}
                      </p>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="安全与危机">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    title="风险识别"
                    value={formatNumber(metrics.safety.risk_detected)}
                    sub="medium/crisis 风险"
                    tone="safety"
                    Icon={Shield}
                  />
                  <MetricCard
                    title="热线点击"
                    value={formatNumber(metrics.safety.hotline_clicked)}
                    sub="希望24 / 120"
                    tone="safety"
                    Icon={AlertTriangle}
                  />
                  <MetricCard
                    title="消息数"
                    value={formatNumber(metrics.engagement.message_sent)}
                    sub={`${formatNumber(metrics.engagement.messages_per_active_user)} / 活跃用户`}
                    Icon={MessageCircle}
                  />
                  <MetricCard
                    title="负反馈率"
                    value={formatNumber(metrics.engagement.negative_feedback_rate, "%")}
                    sub={`${formatNumber(metrics.engagement.negative_feedback)} / ${formatNumber(metrics.engagement.feedback_submitted)} 条反馈`}
                    Icon={Activity}
                  />
                </div>
              </Section>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <Section title="模型质量">
                <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 gap-3">
                  <MetricCard
                    title="OpenAI 使用率"
                    value={formatNumber(metrics.model_quality.openai_usage_rate, "%")}
                    sub="非降级回复占比"
                    tone="model"
                    Icon={Brain}
                  />
                  <MetricCard
                    title="聊天错误"
                    value={formatNumber(metrics.engagement.chat_error)}
                    sub="前端请求失败"
                    tone="model"
                    Icon={AlertTriangle}
                  />
                </div>
              </Section>

              <Section title="设置与隐私">
                <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 gap-3">
                  <MetricCard
                    title="紧急联系人"
                    value={formatNumber(metrics.settings.emergency_contact_added)}
                    sub="添加次数"
                    tone="privacy"
                    Icon={UserCheck}
                  />
                  <MetricCard
                    title="长期记忆开启"
                    value={formatNumber(metrics.settings.long_term_memory_enabled)}
                    sub={`${formatNumber(metrics.settings.long_term_memory_disabled)} 次关闭`}
                    tone="privacy"
                    Icon={Brain}
                  />
                  <MetricCard
                    title="数据导出"
                    value={formatNumber(metrics.settings.data_exported)}
                    sub="用户主动导出"
                    tone="privacy"
                    Icon={Download}
                  />
                  <MetricCard
                    title="删除数据"
                    value={formatNumber(metrics.settings.data_delete_requested)}
                    sub="删除请求"
                    tone="privacy"
                    Icon={Shield}
                  />
                </div>
              </Section>
            </div>

            <Section title="原始事件计数">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {Object.keys(metrics.raw_event_counts).length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">暂无事件。先去前台完成一次签到和对话，再刷新这里。</p>
                ) : (
                  <div className="divide-y divide-border">
                    {Object.entries(metrics.raw_event_counts).map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="font-mono text-xs text-foreground">{name}</span>
                        <span className="text-muted-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </main>
  )
}
