"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Sparkles } from "lucide-react"
import { fetchMoodLogs, getMoodLogs, type MoodLog } from "@/lib/bipolaris-api"
import { FollowupSummary } from "@/components/followup-summary"

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
  const [logs, setLogs] = useState<MoodLog[]>([])

  useEffect(() => {
    setLogs(getMoodLogs())
    fetchMoodLogs()
      .then(setLogs)
      .catch(() => {
        setLogs(getMoodLogs())
      })
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
  const warningDays = reportDays.filter((day) => day.sleep <= 2 || day.impulse >= 4 || day.state === "manic" || day.state === "mixed")
  const weeklyReview = useMemo(() => buildWeeklyReview(logs), [logs])

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

          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">本周状态回顾</h3>
            </div>
            {!weeklyReview.ready ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{weeklyReview.summary}</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-foreground leading-relaxed">{weeklyReview.summary}</p>
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">可能相关的触发因素</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{weeklyReview.triggers.length ? weeklyReview.triggers.join("、") : "本周备注中还没有足够信息。"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">记录到的保护性因素</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{weeklyReview.protectiveFactors.join("、")}</p>
                </div>
                <div className="bg-accent/50 rounded-xl p-3 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-accent-foreground leading-relaxed">{weeklyReview.nextStep}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "summary" && <FollowupSummary logs={logs} />}
    </div>
  )
}

function average(rows: MoodLog[], key: "mood" | "sleep" | "energy" | "impulse"): number {
  return rows.length ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length : 0
}

function buildWeeklyReview(logs: MoodLog[]) {
  const current = logs.slice(0, 7)
  if (current.length < 3) {
    return {
      ready: false,
      summary: `目前有 ${current.length} 条记录；至少完成 3 次签到后再生成趋势，避免根据单次状态下结论。`,
      triggers: [] as string[], protectiveFactors: [] as string[], nextStep: "",
    }
  }
  const previous = logs.slice(7, 14)
  const sleep = average(current, "sleep")
  const energy = average(current, "energy")
  const impulse = average(current, "impulse")
  const changes: string[] = []
  if (previous.length >= 3) {
    const sleepDelta = sleep - average(previous, "sleep")
    const energyDelta = energy - average(previous, "energy")
    const impulseDelta = impulse - average(previous, "impulse")
    if (sleepDelta <= -0.8) changes.push("睡眠比上一周期明显下降")
    if (energyDelta >= 0.8) changes.push("精力比上一周期升高")
    if (impulseDelta >= 0.8) changes.push("冲动程度比上一周期升高")
  }
  const triggerKeywords = ["熬夜", "加班", "争吵", "压力", "饮酒", "咖啡", "失眠", "漏服", "出差", "分手"]
  const protectiveKeywords = ["运动", "散步", "按时睡", "早睡", "朋友", "家人", "咨询", "复诊", "规律", "吃饭"]
  const notes = current.map((row) => row.notes || "").join(" ")
  const triggers = triggerKeywords.filter((term) => notes.includes(term))
  const protectiveFactors = protectiveKeywords.filter((term) => notes.includes(term))
  if (current.filter((row) => row.medication === "taken").length >= Math.ceil(current.length * 0.7)) protectiveFactors.push("多数记录为按时用药")
  if (sleep >= 3) protectiveFactors.push("平均睡眠记录相对稳定")
  if (!protectiveFactors.length) protectiveFactors.push("持续完成状态记录")
  const highActivation = sleep <= 2.5 && (energy >= 3.8 || impulse >= 3.5)
  const nextStep = highActivation
    ? "下周先保护睡眠并延迟重大决定；如果这种组合继续出现，请把记录带给复诊医生。"
    : warningDaysText(current)
  return {
    ready: true,
    summary: changes.length
      ? `相比上一周期，${changes.join("，")}。这是记录变化，不代表诊断或复发结论。`
      : previous.length >= 3
        ? "与上一周期相比，暂未看到达到提示阈值的明显变化。"
        : `本周已记录 ${current.length} 次；上一周期数据不足，暂不进行周期比较。`,
    triggers,
    protectiveFactors: Array.from(new Set(protectiveFactors)),
    nextStep,
  }
}

function warningDaysText(rows: MoodLog[]): string {
  const lowMood = rows.filter((row) => row.mood <= 2).length
  return lowMood >= 2
    ? "下周继续降低行动门槛，优先维持吃饭、饮水和睡眠；低落持续或加重时联系专业支持。"
    : "下周继续保持低负担记录，特别留意睡眠、精力和冲动是否同时变化。"
}
