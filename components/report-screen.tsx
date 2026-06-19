"use client"

import { useEffect, useState } from "react"
import { CalendarDays, FileText, TrendingUp } from "lucide-react"
import { getMoodLogs, type MoodLog } from "@/lib/bipolaris-api"

const stateLabel: Record<string, string> = {
  stable: "平稳",
  depressed: "抑郁相",
  manic: "躁狂相",
  mixed: "混合",
  unknown: "未知",
}

export function ReportScreen() {
  const [logs, setLogs] = useState<MoodLog[]>([])

  useEffect(() => {
    setLogs(getMoodLogs())
  }, [])

  const recent = logs.slice(0, 7)
  const average = (key: "mood" | "sleep" | "energy" | "impulse") => {
    if (!recent.length) return "-"
    const value = recent.reduce((sum, log) => sum + log[key], 0) / recent.length
    return value.toFixed(1)
  }

  return (
    <div className="min-h-full bg-background px-5 py-6">
      <div className="mb-6">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Mood Tracking</p>
        <h1 className="text-2xl font-semibold text-foreground">状态记录</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">当前版本先使用浏览器本地记录，后续会接后端数据库和复诊摘要导出。</p>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-2">
        {[
          ["情绪", average("mood")],
          ["睡眠", average("sleep")],
          ["精力", average("energy")],
          ["冲动", average("impulse")],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <section className="mb-5 rounded-3xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">最近 7 次记录</h2>
        </div>
        {recent.length ? (
          <div className="space-y-3">
            {recent.map((log) => (
              <div key={log.id} className="rounded-2xl bg-muted/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{stateLabel[log.state] || "未知"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>情绪 {log.mood}/5</span>
                  <span>睡眠 {log.sleep}/5</span>
                  <span>精力 {log.energy}/5</span>
                  <span>冲动 {log.impulse}/5</span>
                </div>
                {log.notes && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{log.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">还没有记录。完成一次签到后，这里会出现你的状态历史。</p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">复诊摘要雏形</h2>
        </div>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>过去记录数：{recent.length} 条。</p>
          <p>主要观察：{recent.length ? `平均睡眠 ${average("sleep")}/5，平均冲动 ${average("impulse")}/5。` : "暂无足够记录生成趋势。"}</p>
          <p>下一步会接后端摘要接口，把这部分生成给医生看的结构化报告。</p>
        </div>
      </section>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-xs leading-relaxed text-accent-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" />
        连续记录 7 天后，复诊摘要会更有参考价值。
      </div>
    </div>
  )
}
