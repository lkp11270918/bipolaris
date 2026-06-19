"use client"

import { AlertTriangle, Database, Shield } from "lucide-react"

export function SettingsScreen() {
  return (
    <div className="min-h-full bg-background px-5 py-6">
      <div className="mb-6">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-semibold text-foreground">设置与安全</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">测试版重点是让你清楚知道产品边界、危机资源和数据状态。</p>
      </div>

      <div className="space-y-4">
        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">产品边界</h2>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>Bipolaris 不能诊断疾病、替代精神科医生、心理咨询师或急诊服务。</p>
            <p>涉及停药、加药、减药、补服或副作用处理，请联系医生或药师。</p>
          </div>
        </section>

        <section className="rounded-3xl border border-destructive/25 bg-destructive/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-base font-semibold text-destructive">危机资源</h2>
          </div>
          <div className="space-y-2">
            <a href="tel:4001619995" className="block rounded-2xl bg-card px-4 py-3 text-sm font-medium text-destructive">希望24热线 400-161-9995</a>
            <a href="tel:120" className="block rounded-2xl bg-card px-4 py-3 text-sm font-medium text-destructive">急救电话 120</a>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">数据状态</h2>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>匿名用户 ID 保存在浏览器本地，用于提交反馈和后续记录关联。</p>
            <p>状态记录当前保存在浏览器本地，后续会迁移到后端数据库。</p>
            <p>聊天回复反馈会发送到后端 `/feedback`，用于 badcase 分析。</p>
          </div>
        </section>
      </div>
    </div>
  )
}
