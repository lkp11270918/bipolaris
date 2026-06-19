"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface CheckinScreenProps {
  onComplete: (data: CheckinData) => void
}

export interface CheckinData {
  mood: number
  sleep: number
  energy: number
  impulse: number
  medication: "taken" | "missed" | "partial" | "none"
  state: "stable" | "depressed" | "manic" | "mixed" | "unknown"
  notes: string
}

const moodLabels = ["很糟糕", "比较差", "一般", "还不错", "很好"]
const moodColors = [
  "bg-blue-100 border-blue-300 text-blue-700",
  "bg-blue-50 border-blue-200 text-blue-600",
  "bg-amber-50 border-amber-200 text-amber-600",
  "bg-green-50 border-green-200 text-green-600",
  "bg-green-100 border-green-300 text-green-700",
]

function ScaleSelector({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`h-11 flex-1 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${value === item ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground"}`}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function StateCard({
  label,
  desc,
  color,
  selected,
  onClick,
}: {
  label: string
  desc: string
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-2xl border-2 p-3 text-left transition-all active:scale-95 ${selected ? `${color} border-opacity-80` : "border-border bg-card"}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{desc}</div>
    </button>
  )
}

export function CheckinScreen({ onComplete }: CheckinScreenProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<CheckinData>({
    mood: 0,
    sleep: 0,
    energy: 0,
    impulse: 0,
    medication: "none",
    state: "unknown",
    notes: "",
  })

  const steps = ["情绪", "睡眠与精力", "状态", "用药"]
  const canProceed = [data.mood > 0, data.sleep > 0 && data.energy > 0 && data.impulse > 0, data.state !== "unknown", true]

  const updateData = <K extends keyof CheckinData>(key: K, value: CheckinData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1)
    else onComplete(data)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="px-6 pb-4 pt-12">
        <div className="mb-6 flex items-center justify-between">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <div />
          )}
          <span className="text-sm text-muted-foreground">{step + 1} / {steps.length}</span>
          <button onClick={() => onComplete(data)} className="text-sm text-muted-foreground">跳过</button>
        </div>
        <div className="flex gap-1.5">
          {steps.map((_, index) => (
            <div key={index} className={`h-1 flex-1 rounded-full transition-all duration-300 ${index <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {step === 0 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">今天感觉怎么样？</h2>
              <p className="text-sm text-muted-foreground">选择最符合你当前情绪的选项</p>
            </div>
            <div className="mb-6 grid grid-cols-5 gap-2">
              {moodLabels.map((label, index) => (
                <button
                  key={label}
                  onClick={() => updateData("mood", index + 1)}
                  className={`rounded-2xl border-2 py-4 text-center text-xs font-medium transition-all active:scale-95 ${data.mood === index + 1 ? moodColors[index] : "border-border bg-card text-muted-foreground"}`}
                >
                  <div className="mb-1 text-2xl">{["😞", "😕", "😐", "🙂", "😊"][index]}</div>
                  <div className="leading-tight">{label}</div>
                </button>
              ))}
            </div>
            {data.mood > 0 && (
              <div className="mt-2 rounded-2xl bg-accent/40 p-4">
                <p className="text-sm text-accent-foreground">你选择了「<strong>{moodLabels[data.mood - 1]}</strong>」，我会在对话中记住这一点。</p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">睡眠与精力</h2>
              <p className="text-sm text-muted-foreground">1 = 很差，5 = 很好</p>
            </div>
            <div className="space-y-6">
              {[
                { label: "昨晚睡眠质量", key: "sleep" as const, value: data.sleep, sublabels: ["很差", "较差", "一般", "较好", "很好"], ends: ["很差", "很好"] },
                { label: "今日精力水平", key: "energy" as const, value: data.energy, sublabels: ["极度疲惫", "比较疲惫", "一般", "比较充沛", "精力旺盛"], ends: ["极度疲惫", "精力旺盛"] },
                { label: "冲动程度", key: "impulse" as const, value: data.impulse, sublabels: ["非常平静", "较平静", "一般", "有些冲动", "非常冲动"], ends: ["非常平静", "非常冲动"] },
              ].map((field) => (
                <div key={field.key}>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    <span className="text-sm text-muted-foreground">{field.value > 0 ? field.sublabels[field.value - 1] : "未选择"}</span>
                  </div>
                  <ScaleSelector value={field.value} onChange={(value) => updateData(field.key, value)} />
                  <div className="mt-1.5 flex justify-between px-1">
                    <span className="text-xs text-muted-foreground">{field.ends[0]}</span>
                    <span className="text-xs text-muted-foreground">{field.ends[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">你觉得自己处于哪种状态？</h2>
              <p className="text-sm text-muted-foreground">这会帮助我们给你更合适的支持</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3">
              {[
                { key: "stable", label: "平稳", desc: "情绪比较稳定，没有明显波动", color: "bg-green-50 border-green-400 text-green-800" },
                { key: "depressed", label: "抑郁相", desc: "情绪低落，动力不足，感到疲惫或绝望", color: "bg-blue-50 border-blue-400 text-blue-800" },
                { key: "manic", label: "躁狂相", desc: "精力过旺，思维快速，睡眠需求减少", color: "bg-amber-50 border-amber-400 text-amber-800" },
                { key: "mixed", label: "混合状态", desc: "同时存在抑郁与躁狂特征，感到矛盾", color: "bg-orange-50 border-orange-400 text-orange-800" },
              ].map((state) => (
                <StateCard key={state.key} label={state.label} desc={state.desc} color={state.color} selected={data.state === state.key} onClick={() => updateData("state", state.key as CheckinData["state"])} />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">今日用药情况</h2>
              <p className="text-sm text-muted-foreground">记录是否按时服药，帮助追踪依从性</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3">
              {[
                { key: "taken", label: "已按时服药", color: "bg-green-50 border-green-400 text-green-800" },
                { key: "partial", label: "部分服药", color: "bg-amber-50 border-amber-400 text-amber-800" },
                { key: "missed", label: "忘记服药", color: "bg-red-50 border-red-300 text-red-800" },
                { key: "none", label: "无需服药", color: "bg-muted border-border text-foreground" },
              ].map((medication) => (
                <button key={medication.key} onClick={() => updateData("medication", medication.key as CheckinData["medication"])} className={`rounded-2xl border-2 p-4 text-sm font-medium transition-all active:scale-95 ${data.medication === medication.key ? medication.color : "border-border bg-card text-muted-foreground"}`}>
                  {medication.label}
                </button>
              ))}
            </div>
            <label className="mb-2 block text-sm font-medium text-foreground">有什么想补充的吗？（选填）</label>
            <textarea
              value={data.notes}
              onChange={(event) => updateData("notes", event.target.value)}
              placeholder="今天发生了什么，或者有什么特别的感受..."
              className="h-28 w-full resize-none rounded-2xl border border-border bg-card p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
      </div>

      <div className="px-6 pb-8 pt-4">
        <button onClick={handleNext} disabled={!canProceed[step]} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-medium transition-all active:scale-[0.98] ${canProceed[step] ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "cursor-not-allowed bg-muted text-muted-foreground"}`}>
          {step < steps.length - 1 ? <><span>继续</span><ChevronRight className="h-5 w-5" /></> : "完成签到，开始对话"}
        </button>
      </div>
    </div>
  )
}
