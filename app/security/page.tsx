export default function SecurityPage() {
  return (
    <main className="min-h-dvh bg-background">
      <article className="max-w-3xl mx-auto px-5 py-10 text-foreground">
        <p className="text-sm text-muted-foreground mb-2">BiPolaris</p>
        <h1 className="text-3xl font-semibold mb-3">安全与合规说明</h1>
        <p className="text-sm text-muted-foreground mb-8">更新日期：2026-07-01</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold mb-2">数据安全措施</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>前后端传输通过 HTTPS/TLS。</li>
              <li>事件埋点过滤完整聊天原文、回复原文、电话和自由文本备注。</li>
              <li>用户删除数据时，会删除 mood logs、用户设置和事件日志。</li>
              <li>后台指标接口采用管理员访问保护。</li>
              <li>
                昵称、年龄段、诊疗状态、紧急联系人和情绪备注等敏感字段支持应用层字段加密。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">字段级加密</h2>
            <p>
              对于紧急联系人、诊疗状态、年龄段、昵称和情绪备注等敏感字段，BiPolaris 会在后端保存前进行应用层加密，
              读取时再在服务端完成解密。这样可以降低数据库泄露或未经授权访问带来的风险。
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
            <h2 className="text-lg font-semibold mb-2">服务边界与心理安全</h2>
            <p>
              BiPolaris 按照“辅助支持而非医疗替代”的原则设计回复边界。系统会避免提供诊断、处方、剂量调整或治疗方案；
              当识别到自伤、自杀、伤害他人、药物过量或严重失控风险时，会优先提供危机热线、急救电话和现实支持建议。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">治理与审计</h2>
            <p>
              BiPolaris 会持续通过日志脱敏、敏感字段过滤、badcase 复盘和安全规则更新来改进产品质量。
              产品的隐私政策、用户协议和医疗免责声明会随功能变化进行更新。
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
