"use client"

import { useMemo, useState } from "react"
import { Download, FileText, Lock, Share2, Sparkles } from "lucide-react"
import { trackEvent, type MoodLog } from "@/lib/bipolaris-api"

const stateLabels: Record<string, string> = {
  stable: "平稳",
  depressed: "抑郁相",
  manic: "躁狂相",
  mixed: "混合状态",
  unknown: "未知",
}

const medicationLabels: Record<string, string> = {
  taken: "已按时服药",
  missed: "忘记服药",
  partial: "部分服药",
  none: "无需服药",
}

function average(logs: MoodLog[], key: "mood" | "sleep" | "energy" | "impulse") {
  if (!logs.length) return "-"
  return (logs.reduce((sum, log) => sum + Number(log[key] || 0), 0) / logs.length).toFixed(1)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] || 0) + 1
    return acc
  }, {})
}

function topEntries(record: Record<string, number>) {
  return Object.entries(record).sort((a, b) => b[1] - a[1])
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function buildDoctorSummary(logs: MoodLog[]) {
  const sorted = [...logs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30)
    .reverse()
  const hasLogs = sorted.length > 0
  const stateCounts = countBy(sorted.map((log) => log.state))
  const medicationCounts = countBy(sorted.map((log) => log.medication))
  const warningDays = sorted.filter(
    (log) => log.sleep <= 2 || log.impulse >= 4 || log.state === "manic" || log.state === "mixed",
  )
  const sleepEnergyFlags = sorted.filter((log) => log.sleep <= 2 && log.energy >= 4)
  const notes = sorted.map((log) => log.notes).filter(Boolean)
  const dateRange =
    sorted.length > 1
      ? `${formatDate(sorted[0].createdAt)} - ${formatDate(sorted[sorted.length - 1].createdAt)}`
      : sorted[0]
        ? formatDate(sorted[0].createdAt)
        : "暂无记录"

  return {
    logs: sorted,
    hasLogs,
    dateRange,
    avgMood: average(sorted, "mood"),
    avgSleep: average(sorted, "sleep"),
    avgEnergy: average(sorted, "energy"),
    avgImpulse: average(sorted, "impulse"),
    dominantState: topEntries(stateCounts)[0]?.[0] || "unknown",
    stateCounts,
    medicationCounts,
    warningDays,
    sleepEnergyFlags,
    notes,
  }
}

function reportHtml(summary: ReturnType<typeof buildDoctorSummary>, premium: boolean) {
  const stateRows = topEntries(summary.stateCounts)
    .map(([state, count]) => `<li>${escapeHtml(stateLabels[state] || state)}：${count} 次</li>`)
    .join("")
  const medRows = topEntries(summary.medicationCounts)
    .map(([state, count]) => `<li>${escapeHtml(medicationLabels[state] || state)}：${count} 次</li>`)
    .join("")
  const dailyRows = summary.logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDate(log.createdAt))}</td>
          <td>${log.mood}/5</td>
          <td>${log.sleep}/5</td>
          <td>${log.energy}/5</td>
          <td>${log.impulse}/5</td>
          <td>${escapeHtml(stateLabels[log.state] || log.state)}</td>
          <td>${escapeHtml(medicationLabels[log.medication] || log.medication)}</td>
        </tr>
      `,
    )
    .join("")

  return `
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>BiPolaris 复诊摘要</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif; color: #2b2926; line-height: 1.7; padding: 32px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #ddd8cf; padding-bottom: 6px; }
    p, li, td, th { font-size: 12px; }
    .meta { color: #6f6a61; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .metric { border: 1px solid #ddd8cf; border-radius: 10px; padding: 10px; }
    .metric strong { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd8cf; padding: 6px; text-align: left; }
    th { background: #f5f0ea; }
    .notice { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px; }
  </style>
</head>
<body>
  <h1>BiPolaris 复诊前状态摘要</h1>
  <p class="meta">记录范围：${escapeHtml(summary.dateRange)} · 记录次数：${summary.logs.length} 次</p>
  <div class="notice">本摘要基于用户自我记录生成，仅用于复诊沟通辅助，不构成诊断、处方或治疗建议。</div>

  <h2>1. 核心指标</h2>
  <div class="grid">
    <div class="metric">平均情绪<strong>${summary.avgMood}/5</strong></div>
    <div class="metric">平均睡眠<strong>${summary.avgSleep}/5</strong></div>
    <div class="metric">平均精力<strong>${summary.avgEnergy}/5</strong></div>
    <div class="metric">平均冲动<strong>${summary.avgImpulse}/5</strong></div>
  </div>

  <h2>2. 状态分布</h2>
  <ul>${stateRows || "<li>暂无记录</li>"}</ul>

  <h2>3. 睡眠、精力与冲动风险线索</h2>
  <p>出现睡眠偏低、冲动升高、躁狂相或混合状态等需关注记录：${summary.warningDays.length} 次。</p>
  <p>其中睡眠偏低但精力偏高组合：${summary.sleepEnergyFlags.length} 次。</p>

  <h2>4. 用药记录</h2>
  <ul>${medRows || "<li>暂无记录</li>"}</ul>
  <p>如涉及漏服、补服、停药、加药、减药或副作用，请由医生或药师判断。</p>

  <h2>5. 复诊建议议题</h2>
  <ul>
    <li>近期主要状态：${escapeHtml(stateLabels[summary.dominantState] || "未知")}</li>
    <li>睡眠变化是否伴随精力升高或冲动升高。</li>
    <li>用药依从性、漏服原因和不适反应。</li>
    <li>是否出现明显危险信号、混合状态或影响工作/关系的波动。</li>
    ${premium ? "<li>结合备注和趋势，讨论可能的触发因素与复发预警信号。</li>" : ""}
  </ul>

  ${premium ? `<h2>6. 用户补充备注</h2><ul>${summary.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("") || "<li>暂无备注</li>"}</ul>` : ""}

  <h2>7. 每日记录明细</h2>
  <table>
    <thead><tr><th>日期</th><th>情绪</th><th>睡眠</th><th>精力</th><th>冲动</th><th>状态</th><th>用药</th></tr></thead>
    <tbody>${dailyRows || "<tr><td colspan='7'>暂无记录</td></tr>"}</tbody>
  </table>
</body>
</html>
`
}

export function FollowupSummary({ logs }: { logs: MoodLog[] }) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const summary = useMemo(() => buildDoctorSummary(logs), [logs])

  function exportPdf() {
    if (!summary.hasLogs) return
    trackEvent("followup_pdf_exported", {
      premium_unlocked: premiumUnlocked,
      mood_log_count: summary.logs.length,
    })
    const popup = window.open("", "_blank")
    if (!popup) return
    popup.document.write(reportHtml(summary, premiumUnlocked))
    popup.document.close()
    popup.focus()
    popup.print()
  }

  async function shareReport() {
    if (!summary.hasLogs) return
    trackEvent("followup_report_shared", {
      premium_unlocked: premiumUnlocked,
      mood_log_count: summary.logs.length,
    })
    const title = "BiPolaris 复诊前状态摘要"
    const text = `记录范围：${summary.dateRange}\n平均情绪：${summary.avgMood}/5\n平均睡眠：${summary.avgSleep}/5\n主要状态：${stateLabels[summary.dominantState] || "未知"}`
    if (navigator.share) {
      await navigator.share({ title, text }).catch(() => {})
      return
    }
    await navigator.clipboard?.writeText(`${title}\n${text}`).catch(() => {})
  }

  return (
    <div className="px-5 space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">给医生看的复诊前摘要</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              按复诊沟通场景整理情绪、睡眠、精力、冲动、状态分布和用药记录。摘要只做事实整理，不做诊断。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">正式摘要</p>
              <p className="text-xs text-muted-foreground">{summary.dateRange}</p>
            </div>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {summary.logs.length} 次记录
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["情绪", summary.avgMood],
              ["睡眠", summary.avgSleep],
              ["精力", summary.avgEnergy],
              ["冲动", summary.avgImpulse],
            ].map(([label, value]) => (
              <div key={label} className="bg-muted rounded-2xl p-3">
                <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
                <p className="text-lg font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <section>
            <p className="text-xs font-medium text-foreground mb-1">整体状态</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              最近 {summary.logs.length} 次记录中，主要状态为
              {stateLabels[summary.dominantState] || "未知"}。出现需复诊时说明的睡眠偏低、冲动升高、躁狂相或混合状态记录
              {summary.warningDays.length} 次。
            </p>
          </section>

          <section>
            <p className="text-xs font-medium text-foreground mb-1">睡眠与精力</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              平均睡眠 {summary.avgSleep}/5，平均精力 {summary.avgEnergy}/5。
              {summary.sleepEnergyFlags.length > 0
                ? `其中 ${summary.sleepEnergyFlags.length} 次出现睡眠偏低但精力偏高，建议复诊时重点说明。`
                : "暂未记录到睡眠偏低但精力偏高的组合。"}
            </p>
          </section>

          <section>
            <p className="text-xs font-medium text-foreground mb-1">用药记录</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {topEntries(summary.medicationCounts)
                .map(([key, count]) => `${medicationLabels[key] || key} ${count} 次`)
                .join("，") || "暂无用药记录"}
              。涉及补服、停药、加药、减药或副作用，请咨询医生或药师。
            </p>
          </section>

          <section className={premiumUnlocked ? "" : "relative overflow-hidden rounded-2xl"}>
            <div className={premiumUnlocked ? "" : "blur-sm pointer-events-none select-none"}>
              <p className="text-xs font-medium text-foreground mb-1">高级摘要：复诊建议议题</p>
              <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
                <li>· 近期主要状态是否与医生预期一致。</li>
                <li>· 睡眠变化是否伴随精力、冲动或消费/冒险行为变化。</li>
                <li>· 漏服、部分服药、不适反应和是否需要用药教育。</li>
                <li>· 可能触发波动的事件、作息变化或压力来源。</li>
              </ul>
            </div>
            {!premiumUnlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-card/70">
                <div className="text-center px-4">
                  <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">解锁高级摘要后显示</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">高级复诊摘要</p>
            <p className="text-xs text-muted-foreground">补充复诊议题、触发因素和完整备注</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">¥6.9</p>
            <p className="text-xs text-muted-foreground">一次性</p>
          </div>
        </div>
        <button
          onClick={() => {
            trackEvent("paid_summary_clicked", { mood_log_count: summary.logs.length })
            setShowPaywall(true)
          }}
          disabled={!summary.hasLogs}
          className={`w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
            summary.hasLogs ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {summary.hasLogs ? (premiumUnlocked ? "已解锁高级摘要" : "解锁高级摘要") : "先完成一次签到"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 pb-4">
        <button
          onClick={exportPdf}
          disabled={!summary.hasLogs}
          className="flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl text-sm text-foreground disabled:text-muted-foreground"
        >
          <Download className="w-4 h-4" />
          导出 PDF
        </button>
        <button
          onClick={() => void shareReport()}
          disabled={!summary.hasLogs}
          className="flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl text-sm text-foreground disabled:text-muted-foreground"
        >
          <Share2 className="w-4 h-4" />
          分享给医生
        </button>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setShowPaywall(false)}>
          <div className="w-full bg-card rounded-t-3xl p-6" onClick={(event) => event.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-semibold text-foreground mb-2">高级摘要</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              当前版本先开放高级摘要预览流程。正式上线支付后，这里会接入真实支付并生成可保存的高级报告。
            </p>
            <button
              onClick={() => {
                setPremiumUnlocked(true)
                setShowPaywall(false)
                trackEvent("paid_summary_unlocked_demo", { mood_log_count: summary.logs.length })
              }}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium"
            >
              预览解锁高级摘要
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
