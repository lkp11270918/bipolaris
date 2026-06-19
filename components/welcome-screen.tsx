"use client"

import { useState } from "react"
import { BookOpen, ChevronRight, Heart, Shield } from "lucide-react"

interface WelcomeScreenProps {
  onComplete: () => void
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<"intro" | "disclaimer">("intro")
  const [agreed, setAgreed] = useState(false)

  if (step === "disclaimer") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-12">
          <div className="mb-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold leading-snug text-foreground">使用前，请先了解</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">Bipolaris 是一款情绪支持工具，不是医疗产品。</p>
          </div>

          <div className="mb-8 space-y-4">
            {[
              ["我们不替代医生", "Bipolaris 无法诊断疾病、开具处方或调整用药。所有医疗决策请遵医嘱，并咨询精神科医生或药师。"],
              ["危机时请拨打热线", "若你出现伤害自己或他人的想法，请立即拨打希望24热线 400-161-9995 或急救电话 120。"],
              ["数据仍在测试阶段", "当前测试版优先使用匿名 ID 与本地状态记录，正式公开前仍需完善隐私政策和数据删除机制。"],
              ["产品仍在早期阶段", "AI 存在错误和局限。如有不适或不满意的回复，可以直接通过反馈按钮告诉我们。"],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-4">
                <h3 className="mb-1 text-sm font-medium text-foreground">{title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setAgreed(!agreed)} className="mb-8 flex w-full cursor-pointer items-start gap-3 text-left">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${agreed ? "border-primary bg-primary" : "border-border bg-card"}`}>
              {agreed && (
                <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              )}
            </div>
            <span className="text-sm leading-relaxed text-foreground">我已阅读并理解以上内容，同意以测试版方式使用 Bipolaris。</span>
          </button>
        </div>

        <div className="px-6 pb-8 pt-2">
          <button
            onClick={() => agreed && onComplete()}
            disabled={!agreed}
            className={`w-full rounded-2xl py-4 text-base font-medium transition-all ${agreed ? "bg-primary text-primary-foreground active:scale-[0.98]" : "cursor-not-allowed bg-muted text-muted-foreground"}`}
          >
            开始使用 Bipolaris
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-6 pb-8 pt-16">
        <div>
          <div className="mb-10">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-primary/20">
              <svg fill="none" height="32" viewBox="0 0 32 32" width="32">
                <path d="M16 4C16 4 8 10 8 18C8 22.4183 11.5817 26 16 26C20.4183 26 24 22.4183 24 18C24 10 16 4 16 4Z" fill="white" fillOpacity="0.9" />
                <circle cx="16" cy="18" fill="white" fillOpacity="0.5" r="4" />
              </svg>
            </div>
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">Bipolaris</h1>
            <p className="text-lg leading-relaxed text-muted-foreground">专为双相情感障碍设计的<br />AI 情绪陪伴助手</p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Heart, title: "状态感知支持", desc: "根据平稳、抑郁、躁狂或混合状态提供更贴近情境的支持。", color: "bg-rose-50 text-rose-500" },
              { icon: Shield, title: "危机识别与分流", desc: "优先识别高风险信号，引导你获得现实中的专业帮助。", color: "bg-blue-50 text-blue-500" },
              { icon: BookOpen, title: "复诊状态摘要", desc: "记录每日情绪波动，为后续复诊摘要和趋势分析打基础。", color: "bg-amber-50 text-amber-500" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-0.5 text-sm font-medium text-foreground">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <button onClick={() => setStep("disclaimer")} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]">
            了解更多并开始
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">本产品不替代医疗诊断与治疗</p>
        </div>
      </div>
    </div>
  )
}
