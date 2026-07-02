export default function SecurityPage() {
  return (
    <main className="min-h-dvh bg-background">
      <article className="max-w-3xl mx-auto px-5 py-10 text-foreground">
        <p className="text-sm text-muted-foreground mb-2">BiPolaris</p>
        <h1 className="text-3xl font-semibold mb-3">数据安全与加密说明</h1>
        <p className="text-sm text-muted-foreground mb-8">更新日期：2026-07-01</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold mb-2">当前已实现</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>前后端传输通过 HTTPS/TLS。</li>
              <li>事件埋点过滤完整聊天原文、回复原文、电话和自由文本备注。</li>
              <li>用户删除数据时，会删除 mood logs、用户设置和事件日志。</li>
              <li>支持通过 `ADMIN_METRICS_TOKEN` 保护后台指标接口。</li>
              <li>
                支持通过 `DATA_ENCRYPTION_KEY` 对昵称、年龄段、诊疗状态、紧急联系人和 mood notes 进行应用层字段加密。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">字段级加密</h2>
            <p>
              生产环境配置 `DATA_ENCRYPTION_KEY` 后，后端会在保存敏感字段前使用 Fernet 对称加密，
              读取时自动解密。数据库中保存的值会带有 `enc:v1:` 前缀。
            </p>
            <p className="mt-2">
              若未配置该密钥，本地开发环境会以明文保存，便于调试；生产环境必须配置密钥。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">不进入普通埋点的数据</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>完整聊天内容。</li>
              <li>AI 完整回复。</li>
              <li>紧急联系人电话号码。</li>
              <li>用户自由文本备注。</li>
              <li>详细自伤/他伤计划。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">上线前必须确认</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Render 已配置 `DATABASE_URL`，且数据库具备加密存储和访问控制。</li>
              <li>Render 已配置 `DATA_ENCRYPTION_KEY` 和 `ADMIN_METRICS_TOKEN`。</li>
              <li>日志和 badcase 结果不包含完整敏感原文，或仅在授权测试环境保留。</li>
              <li>隐私政策、用户协议、危机提示和医疗免责声明完成法务审核。</li>
            </ul>
          </section>
        </div>
      </article>
    </main>
  )
}
