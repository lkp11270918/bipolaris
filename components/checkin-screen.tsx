"use client"

import { useState } from "react"
import { ChevronRight, ChevronLeft } from "lucide-react"

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

function ScaleSelector({
  value,
  onChange,
  min = 1,
  max = 5,
  labels,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  labels?: string[]
}) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min)
  return (
    <div className="flex gap-2">
      {items.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 h-11 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
            value === v
              ? "bg-primary border-primary text-primary-foreground shadow-sm"
              : "bg-card border-border text-muted-foreground"
          }`}
        >
          {v}
        </button>
      ))}
      {labels && value > 0 && (
        <span className="sr-only">{labels[value - min]}</span>
      )}
    </div>
  )
}

const StateCard = ({
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
}) => (
  <button
    onClick={onClick}
    className={`flex-1 p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
      selected ? `${color} border-opacity-80` : "bg-card border-border"
    }`}
  >
    <div className="text-sm font-medium">{label}</div>
    <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</div>
  </button>
)

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
  const canProceed = [
    data.mood > 0,
    data.sleep > 0 && data.energy > 0 && data.impulse > 0,
    data.state !== "unknown",
    true,
  ]

  const updateData = <K extends keyof CheckinData>(key: K, value: CheckinData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }))

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      onComplete(data)
    }
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* 顶部 */}
      <div className="px-6 pt-12 pb-4">
        <div className="flex items-center justify-between mb-6">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <div />
          )}
          <span className="text-sm text-muted-foreground">
            {step + 1} / {steps.length}
          </span>
          <button
            onClick={() => onComplete(data)}
            className="text-sm text-muted-foreground"
          >
            跳过
          </button>
        </div>

        {/* 进度条 */}
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 px-6 overflow-y-auto">
        {step === 0 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="text-2xl font-semibold text-foreground mb-2">今天感觉怎么样？</h2>
              <p className="text-muted-foreground text-sm">选择最符合你当前情绪的选项</p>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-6">
              {moodLabels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => updateData("mood", i + 1)}
                  className={`py-4 rounded-2xl border-2 text-xs font-medium text-center transition-all active:scale-95 ${
                    data.mood === i + 1
                      ? moodColors[i]
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {["😞", "😕", "😐", "🙂", "😊"][i]}
                  </div>
                  <div className="leading-tight">{label}</div>
                </button>
              ))}
            </div>
            {data.mood > 0 && (
              <div className="bg-accent/40 rounded-2xl p-4 mt-2">
                <p className="text-sm text-accent-foreground">
                  你选择了「<strong>{moodLabels[data.mood - 1]}</strong>」，我会在对话中记住这一点。
                </p>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="text-2xl font-semibold text-foreground mb-2">睡眠与精力</h2>
              <p className="text-muted-foreground text-sm">1 = 很差，5 = 很好</p>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">昨晚睡眠质量</label>
                  <span className="text-sm text-muted-foreground">
                    {data.sleep > 0 ? ["很差", "较差", "一般", "较好", "很好"][data.sleep - 1] : "未选择"}
                  </span>
                </div>
                <ScaleSelector value={data.sleep} onChange={(v) => updateData("sleep", v)} />
                <div className="flex justify-between mt-1.5 px-1">
                  <span className="text-xs text-muted-foreground">很差</span>
                  <span className="text-xs text-muted-foreground">很好</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">今日精力水平</label>
                  <span className="text-sm text-muted-foreground">
                    {data.energy > 0 ? ["极度疲惫", "比较疲惫", "一般", "比较充沛", "精力旺盛"][data.energy - 1] : "未选择"}
                  </span>
                </div>
                <ScaleSelector value={data.energy} onChange={(v) => updateData("energy", v)} />
                <div className="flex justify-between mt-1.5 px-1">
                  <span className="text-xs text-muted-foreground">极度疲惫</span>
                  <span className="text-xs text-muted-foreground">精力旺盛</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">冲动程度</label>
                  <span className="text-sm text-muted-foreground">
                    {data.impulse > 0 ? ["非常平静", "较平静", "一般", "有些冲动", "非常冲动"][data.impulse - 1] : "未选择"}
                  </span>
                </div>
                <ScaleSelector value={data.impulse} onChange={(v) => updateData("impulse", v)} />
                <div className="flex justify-between mt-1.5 px-1">
                  <span className="text-xs text-muted-foreground">非常平静</span>
                  <span className="text-xs text-muted-foreground">非常冲动</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="text-2xl font-semibold text-foreground mb-2">你觉得自己处于哪种状态？</h2>
              <p className="text-muted-foreground text-sm">这会帮助我们给你更合适的支持</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                {
                  key: "stable",
                  label: "平稳",
                  desc: "情绪比较稳定，没有明显波动",
                  color: "bg-green-50 border-green-400 text-green-800",
                },
                {
                  key: "depressed",
                  label: "抑郁相",
                  desc: "情绪低落，动力不足，感到疲惫或绝望",
                  color: "bg-blue-50 border-blue-400 text-blue-800",
                },
                {
                  key: "manic",
                  label: "躁狂相",
                  desc: "精力过旺，思维快速，睡眠需求减少",
                  color: "bg-amber-50 border-amber-400 text-amber-800",
                },
                {
                  key: "mixed",
                  label: "混合状态",
                  desc: "同时存在抑郁与躁狂特征，感到矛盾",
                  color: "bg-orange-50 border-orange-400 text-orange-800",
                },
              ].map((s) => (
                <StateCard
                  key={s.key}
                  label={s.label}
                  desc={s.desc}
                  color={s.color}
                  selected={data.state === s.key}
                  onClick={() => updateData("state", s.key as CheckinData["state"])}
                />
              ))}
            </div>
            <button
              onClick={() => updateData("state", "unknown")}
              className={`w-full py-3 rounded-2xl border-2 text-sm text-center transition-all ${
                data.state === "unknown"
                  ? "bg-muted border-muted-foreground/30 text-foreground"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              不确定 / 说不清楚
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-8 mt-4">
              <h2 className="text-2xl font-semibold text-foreground mb-2">今日用药情况</h2>
              <p className="text-muted-foreground text-sm">记录是否按时服药，帮助追踪依从性</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { key: "taken", label: "已按时服药", color: "bg-green-50 border-green-400 text-green-800" },
                { key: "partial", label: "部分服药", color: "bg-amber-50 border-amber-400 text-amber-800" },
                { key: "missed", label: "忘记服药", color: "bg-red-50 border-red-300 text-red-800" },
                { key: "none", label: "无需服药", color: "bg-muted border-border text-foreground" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => updateData("medication", m.key as CheckinData["medication"])}
                  className={`p-4 rounded-2xl border-2 text-sm font-medium transition-all active:scale-95 ${
                    data.medication === m.key ? m.color : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                有什么想补充的吗？（选填）
              </label>
              <textarea
                value={data.notes}
                onChange={(e) => updateData("notes", e.target.value)}
                placeholder="今天发生了什么，或者有什么特别的感受…"
                className="w-full bg-card border border-border rounded-2xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none h-28 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {data.medication === "missed" && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs text-amber-800 leading-relaxed">
                  如果你不确定是否可以补服，请联系你的医生或药师，不要自行决定。
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="px-6 pb-8 pt-4">
        <button
          onClick={handleNext}
          disabled={!canProceed[step]}
          className={`w-full py-4 rounded-2xl text-base font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            canProceed[step]
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {step < steps.length - 1 ? (
            <>
              继续
              <ChevronRight className="w-5 h-5" />
            </>
          ) : (
            "完成签到，开始对话"
          )}
        </button>
      </div>
    </div>
  )
}
