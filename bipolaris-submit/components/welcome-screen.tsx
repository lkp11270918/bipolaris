"use client"

import { useState } from "react"
import { ChevronRight, Shield, Heart, BookOpen } from "lucide-react"

interface WelcomeScreenProps {
  onComplete: () => void
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<"intro" | "disclaimer">("intro")
  const [agreed, setAgreed] = useState(false)

  if (step === "disclaimer") {
    return (
      <div className="h-full bg-background flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 pt-12 pb-6">
          <div className="mb-8">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground leading-snug mb-2 text-pretty">
              使用前，请先了解
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Bipolaris 是一款情绪支持工具，不是医疗产品。
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {[
              {
                title: "我们不替代医生",
                desc: "Bipolaris 无法诊断疾病、开具处方或调整用药。所有医疗决策请遵医嘱，并咨询您的精神科医生或药师。",
              },
              {
                title: "危机时请拨打热线",
                desc: "若您出现伤害自己或他人的想法，请立即拨打希望24热线 400-161-9995 或急救电话 120。",
              },
              {
                title: "数据隐私与最小化收集",
                desc: "BiPolaris 仅在提供情绪支持、状态记录和安全提示所需范围内处理信息，并通过加密、去标识化和访问控制降低隐私风险。",
              },
              {
                title: "服务条款与用户权利",
                desc: "我们通过隐私政策和用户协议说明数据处理方式、服务边界和用户权利。你可以在设置中查看、导出或删除自己的记录。",
              },
              {
                title: "心理临床安全边界",
                desc: "BiPolaris 在回复中设置危机识别、用药边界和专业求助引导，避免替代诊断、处方、治疗方案或急救服务。",
              },
              {
                title: "产品仍在早期阶段",
                desc: "AI 存在错误和局限，请保持批判性判断。如有不适或不满意的回复，可以直接告诉我们。",
              },
            ].map((item) => (
              <div key={item.title} className="bg-card rounded-2xl p-4 border border-border">
                <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 mb-8 text-left w-full">
            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                agreed ? "bg-primary border-primary" : "border-border bg-card"
              }`}
            >
              {agreed && (
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-sm text-foreground leading-relaxed">
              我已阅读并理解以上内容，同意
              <a className="text-primary" href="/terms" target="_blank" rel="noreferrer"> 用户协议 </a>与
              <a className="text-primary" href="/privacy" target="_blank" rel="noreferrer"> 隐私政策</a>
            </span>
          </div>
        </div>

        <div className="px-6 pb-8 pt-2">
          <button
            onClick={() => agreed && onComplete()}
            disabled={!agreed}
            className={`w-full py-4 rounded-2xl text-base font-medium transition-all ${
              agreed
                ? "bg-primary text-primary-foreground active:scale-[0.98]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            开始使用 Bipolaris
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-between px-6 pt-16 pb-8 overflow-y-auto">
        {/* 品牌区域 */}
        <div>
          <div className="mb-10">
            <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M16 4C16 4 8 10 8 18C8 22.4183 11.5817 26 16 26C20.4183 26 24 22.4183 24 18C24 10 16 4 16 4Z"
                  fill="white"
                  fillOpacity="0.9"
                />
                <circle cx="16" cy="18" r="4" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight mb-3">
              Bipolaris
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed text-pretty">
              专为双相情感障碍设计的
              <br />
              AI 情绪陪伴助手
            </p>
          </div>

          {/* 特性卡片 */}
          <div className="space-y-3">
            {[
              {
                icon: Heart,
                title: "状态感知支持",
                desc: "根据你的情绪状态——平稳、抑郁、躁狂或混合——提供个性化回复",
                color: "bg-rose-50 text-rose-500",
              },
              {
                icon: Shield,
                title: "危机识别与分流",
                desc: "实时识别高风险信号，在危机时刻引导你获得真实帮助",
                color: "bg-blue-50 text-blue-500",
              },
              {
                icon: BookOpen,
                title: "复诊状态摘要",
                desc: "记录每日情绪波动，在复诊前生成状态报告，节省医患沟通时间",
                color: "bg-amber-50 text-amber-500",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 bg-card rounded-2xl p-4 border border-border">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-0.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="mt-8">
          <button
            onClick={() => setStep("disclaimer")}
            className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-base font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            了解更多并开始
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-muted-foreground mt-4">
            本产品不替代医疗诊断与治疗
          </p>
        </div>
      </div>
    </div>
  )
}
