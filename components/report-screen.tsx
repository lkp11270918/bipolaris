"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Lock, TrendingUp, TrendingDown, Minus, ChevronRight, Download, Share2 } from "lucide-react"
import { getMoodLogs, type MoodLog } from "@/lib/bipolaris-api"

type ReportDay = MoodLog & { dateLabel: string }

const stateConfig: Record<string, { label: string; color: string; bar: string }> = {
  stable: { label: "平稳", color: "text-green-700", bar: "bg-green-400" },
  depressed: { label: "抑郁相", color: "text-blue-700", bar: "bg-blue-400" },
  manic: { label: "躁狂相", color: "text-amber-700", bar: "bg-amber-400" },
  mixed: { label: "混合", color: "text-orange-700", bar: "bg-orange-400" },
  unknown: { label: "未知", color: "text-muted-foreground", bar: "bg-border" },
}

function MiniBar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex gap-0.5 items-end h-6">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2.5 rounded-sm transition-all ${i < value ? color : "bg-border"}`}
          style={{ height: `${((i + 1) / max) * 100}%` }}
        />
      ))}
    </div>
  )
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-600" />
  if (trend === "down") return <TrendingDown className="w-4 h-4 text-blue-500" />
  return <Minus className="w-4 h-4 text-muted-foreground" />
}

export function ReportScreen() {
  const [activeTab, setActiveTab] = useState<"week" | "summary">("week")
  const [showPromo, setShowPromo] = useState(false)
  const [logs, setLogs] = useState<MoodLog[]>([])

  useEffect(() => {
    setLogs(getMoodLogs())
  }, [])

  const reportDays = useMemo<ReportDay[]>(() => {
    return logs
      .slice(0, 7)
      .reverse()
      .map((log) => ({
        ...log,
        dateLabel: new Date(log.createdAt).toLocaleDateString("zh-CN", {
          month: "numeric",
          day: "numeric",
        }),
      }))
  }, [logs])

  const hasLogs = reportDays.length > 0
  const avgMood = hasLogs ? (reportDays.reduce((s, d) => s + d.mood, 0) / reportDays.length).toFixed(1) : "-"
  const avgSleep = hasLogs ? (reportDays.reduce((s, d) => s + d.sleep, 0) / reportDays.length).toFixed(1) : "-"
  const stateFreq = reportDays.reduce<Record<string, number>>((acc, d) => {
    acc[d.state] = (acc[d.state] || 0) + 1
    return acc
  }, {})
  const dominantState = Object.entries(stateFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown"
  const latest = logs[0]
  const missedMedicationCount = reportDays.filter((day) => day.medication === "missed").length
  const warningDays = reportDays.filter((day) => day.sleep <= 2 || day.impulse >= 4 || day.state === "manic" || day.state === "mixed")
  const dateRange =
    reportDays.length > 1
      ? `${reportDays[0].dateLabel} - ${reportDays[reportDays.length - 1].dateLabel}`
      : latest
        ? new Date(latest.createdAt).toLocaleDateString("zh-CN")
        : "暂无记录"

  return (
    <div className="flex flex-col bg-background">
      {/* 顶部 */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground mb-1">状态记录</h1>
        <p className="text-sm text-muted-foreground">
          {hasLogs ? `已记录 ${logs.length} 次 · 最近 ${reportDays.length} 条用于趋势分析` : "完成一次签到后，这里会生成你的状态趋势"}
        </p>
      </div>

      {/* Tab */}
      <div className="px-5 mb-4">
        <div className="flex bg-muted rounded-2xl p-1">
          {(["week", "summary"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {tab === "week" ? "本周趋势" : "复诊摘要"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "week" && (
        <div className="px-5 space-y-4">
          {/* 总览卡片 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "平均情绪", value: avgMood, max: hasLogs ? "5" : "", trend: "stable" as const, color: "bg-rose-100 text-rose-600" },
              { label: "平均睡眠", value: avgSleep, max: hasLogs ? "5" : "", trend: "stable" as const, color: "bg-blue-100 text-blue-600" },
              {
                label: "主要状态",
                value: hasLogs ? stateConfig[dominantState]?.label || "未知" : "-",
                max: "",
                trend: "stable" as const,
                color: "bg-amber-100 text-amber-600",
              },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-border rounded-2xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-semibold text-foreground">{item.value}</span>
                  {item.max && <span className="text-xs text-muted-foreground mb-0.5">/{item.max}</span>}
                </div>
                <TrendIcon trend={item.trend} />
              </div>
            ))}
          </div>

          {/* 每日详情 */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-medium text-foreground mb-4">最近记录</h3>
            {hasLogs ? (
              <div className="space-y-3">
              {reportDays.map((day) => {
                const sc = stateConfig[day.state] || stateConfig.unknown
                return (
                  <div key={day.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{day.dateLabel}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">情绪</span>
                        <MiniBar value={day.mood} color="bg-rose-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">睡眠</span>
                        <MiniBar value={day.sleep} color="bg-blue-400" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">精力</span>
                        <MiniBar value={day.energy} color="bg-amber-400" />
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${sc.color} w-14 text-right shrink-0`}>
                      {sc.label}
                    </span>
                  </div>
                )
              })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                还没有状态记录。完成今日签到后，我会在这里展示你的情绪、睡眠和精力变化。
              </p>
            )}
          </div>

          {/* 状态分布 */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">状态分布</h3>
            {hasLogs ? (
              <div className="space-y-2">
              {Object.entries(stateFreq).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
                const sc = stateConfig[state] || stateConfig.unknown
                return (
                  <div key={state} className="flex items-center gap-3">
                    <span className="text-sm text-foreground w-16 shrink-0">{sc.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${sc.bar}`}
                        style={{ width: `${(count / reportDays.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}次</span>
                  </div>
                )
              })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无状态分布。</p>
            )}
          </div>

          {/* 观察提示 */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-amber-800 mb-1">近期观察</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              {hasLogs
                ? warningDays.length > 0
                  ? `最近 ${warningDays.length} 次记录出现睡眠偏低、冲动升高、躁狂相或混合状态等信号，建议复诊时主动告诉医生。`
                  : "最近记录暂未出现明显高风险波动。继续保持规律记录，有助于更早发现状态变化。"
                : "完成几次签到后，我会根据真实记录提示可能需要关注的睡眠、冲动或状态波动。"}
            </p>
          </div>
        </div>
      )}

      {activeTab === "summary" && (
        <div className="px-5 space-y-4">
          {/* 付费提示卡 */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">复诊前状态摘要</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  将过去 7-30 天的情绪波动、睡眠变化、用药记录整合为一份结构化报告，帮助医生快速了解你的近期状态。
                </p>
              </div>
            </div>
          </div>

          {/* 预览（部分模糊） */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">状态摘要报告</p>
                  <p className="text-xs text-muted-foreground">{dateRange}</p>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">预览</span>
              </div>
            </div>

            {/* 摘要内容预览 */}
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-foreground mb-1">情绪波动总结</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {hasLogs
                    ? `最近 ${reportDays.length} 次记录中，平均情绪为 ${avgMood}/5，主要状态为 ${stateConfig[dominantState]?.label || "未知"}。`
                    : "暂无足够记录生成情绪波动总结。完成几次签到后，这里会自动整理近期状态。"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">睡眠变化</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {hasLogs
                    ? `最近记录的平均睡眠为 ${avgSleep}/5。${
                        reportDays.some((day) => day.sleep <= 2 && day.energy >= 4)
                          ? "其中出现过睡眠减少但精力偏高的组合，建议复诊时重点说明。"
                          : "暂未看到明显的睡眠减少伴精力升高组合。"
                      }`
                    : "暂无睡眠趋势。"}
                </p>
              </div>

              {/* 模糊遮罩 */}
              <div className="relative">
                <div className="blur-sm pointer-events-none select-none">
                  <p className="text-xs font-medium text-foreground mb-1">用药依从性</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasLogs
                      ? `最近 ${reportDays.length} 次记录中，漏服 ${missedMedicationCount} 次。${
                          missedMedicationCount > 0 ? "如不确定是否补服，请联系医生或药师。" : "目前未记录到漏服。"
                        }`
                      : "暂无用药记录。"}
                  </p>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-foreground mb-1">复诊建议议题</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li>· 近期主要状态：{hasLogs ? stateConfig[dominantState]?.label || "未知" : "暂无记录"}</li>
                      <li>· 睡眠和精力是否同步变化</li>
                      <li>· 用药依从性和不适感记录</li>
                    </ul>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-card/60">
                  <div className="text-center px-4">
                    <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">付费解锁完整报告</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 定价与解锁 */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-foreground">解锁完整报告</p>
                <p className="text-xs text-muted-foreground">包含用药分析 + 复诊建议议题</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">¥6.9</p>
                <p className="text-xs text-muted-foreground">一次性</p>
              </div>
            </div>
            <button
              onClick={() => setShowPromo(true)}
              disabled={!hasLogs}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <FileText className="w-4 h-4" />
              {hasLogs ? "生成复诊摘要报告" : "先完成一次签到"}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-2">
              {hasLogs ? "连续记录 7 天，可享受 5 折优惠" : "有记录后才能生成摘要"}
            </p>
          </div>

          {/* 订阅计划 */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm font-medium text-foreground mb-1">订阅会员</p>
            <p className="text-xs text-muted-foreground mb-3">解锁长期趋势分析 + 无限次报告 + 个性化 Coping Cards</p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-foreground">¥19</span>
                <span className="text-sm text-muted-foreground">/月</span>
              </div>
              <button className="flex items-center gap-1 text-sm text-primary font-medium">
                了解更多
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 导出 */}
          <div className="grid grid-cols-2 gap-3 pb-4">
            <button className="flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl text-sm text-foreground">
              <Download className="w-4 h-4" />
              导出 PDF
            </button>
            <button className="flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl text-sm text-foreground">
              <Share2 className="w-4 h-4" />
              分享给医生
            </button>
          </div>
        </div>
      )}

      {/* Promo Toast */}
      {showPromo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowPromo(false)}
        >
          <div
            className="w-full bg-card rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              报告生成中
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              这是产品演示原型，实际支付功能将在正式版本中接入。报告将包含完整的情绪分析、用药记录和复诊建议。
            </p>
            <button
              onClick={() => setShowPromo(false)}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium"
            >
              好的，我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
