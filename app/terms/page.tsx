export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <article className="max-w-3xl mx-auto px-5 py-10 text-foreground">
        <p className="text-sm text-muted-foreground mb-2">BiPolaris</p>
        <h1 className="text-3xl font-semibold mb-3">用户协议</h1>
        <p className="text-sm text-muted-foreground mb-8">更新日期：2026-07-01</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. 服务说明</h2>
            <p>
              BiPolaris 提供 AI 情绪支持、状态记录、风险识别、危机资源提示和复诊辅助。服务处于早期阶段，
              可能出现不准确、不完整或不适合你当前情况的回复。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. 医疗边界</h2>
            <p>
              BiPolaris 不是医疗器械、医生、心理咨询师或急救服务。我们不提供诊断、处方、剂量调整、
              停药/加药建议或治疗方案。涉及用药、诊断和治疗，请咨询精神科医生、医生或药师。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. 危机情况</h2>
            <p>
              如果你存在自伤、自杀、伤害他人、药物过量或无法控制的冲动风险，请立即拨打当地急救电话、
              心理危机热线或联系身边可信任的人。BiPolaris 只能提供危机资源提示，不能替代线下救援。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. 用户责任</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>你应对自己输入的信息真实性和后续行为负责。</li>
              <li>你不应将 AI 回复作为唯一决策依据。</li>
              <li>你不应利用本产品生成伤害自己或他人的计划、违法内容或骚扰内容。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. 数据与隐私</h2>
            <p>
              我们会按照隐私政策处理你的数据。你可以在设置中导出或删除自己的数据，也可以关闭长期记忆和紧急联系人授权。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. 服务变更与限制</h2>
            <p>
              我们可能根据安全、合规、运营或技术原因调整、暂停或终止部分功能。若发现严重安全风险，
              我们可能回滚模型、关闭实验功能或限制某些回复能力。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. 免责声明</h2>
            <p>
              在法律允许范围内，BiPolaris 不对因用户将 AI 回复作为医疗、法律、财务或紧急处置依据而产生的后果承担责任。
              用户应结合自身情况、专业意见和现实支持系统作出判断。
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
