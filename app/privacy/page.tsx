export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background">
      <article className="max-w-3xl mx-auto px-5 py-10 text-foreground">
        <p className="text-sm text-muted-foreground mb-2">BiPolaris</p>
        <h1 className="text-3xl font-semibold mb-3">隐私政策</h1>
        <p className="text-sm text-muted-foreground mb-8">更新日期：2026-07-01</p>

        <div className="space-y-6 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. 产品定位</h2>
            <p>
              BiPolaris 是一款面向双相情感障碍及情绪波动人群的 AI 情绪支持与状态记录工具。
              本产品不提供医疗诊断、处方、治疗方案或急救服务，不能替代医生、心理咨询师或急救系统。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. 我们收集的信息</h2>
            <p>为了提供核心功能，我们可能收集以下信息：</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>匿名用户 ID、会话 ID、设备平台和基础使用事件。</li>
              <li>情绪、睡眠、精力、冲动程度、用药状态、状态标签和可选备注。</li>
              <li>对话请求所需的文本、风险识别结果、状态判断结果和 RAG 命中信息。</li>
              <li>你主动填写的昵称、年龄段、诊疗状态和紧急联系人信息。</li>
              <li>点赞/点踩、数据导出、删除请求等产品交互事件。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. 我们如何使用信息</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>提供情绪支持、状态记录、风险识别、危机资源提示和复诊辅助。</li>
              <li>生成隐藏上下文 payload，让模型结合状态、历史和知识库回复。</li>
              <li>分析产品漏斗、模型质量、RAG 命中率、安全触发和用户反馈。</li>
              <li>排查错误、改进安全规则和进行匿名化 badcase 复盘。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. 数据保护</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>传输过程使用 HTTPS/TLS。</li>
              <li>生产环境应配置云数据库加密和访问控制。</li>
              <li>紧急联系人、诊疗状态、年龄段、昵称和 mood notes 支持应用层字段加密。</li>
              <li>分析埋点默认不保存完整聊天原文、回复原文、电话和自由文本备注。</li>
              <li>后台指标接口支持管理员 token 保护。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. 高风险场景</h2>
            <p>
              当系统识别到自伤、自杀、伤害他人、药物过量或严重失控风险时，BiPolaris 会优先提供危机资源、
              急救电话和联系现实支持者的建议。除非你主动授权，系统不会在普通对话中自动向紧急联系人发送你的完整对话内容。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. 第三方服务</h2>
            <p>
              BiPolaris 可能调用 OpenAI API 生成回复，并使用 Render、Vercel 等云服务部署前后端。
              我们会尽量只发送完成当前功能所必要的信息，并通过最小化、脱敏和访问控制降低隐私风险。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. 你的权利</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>你可以在设置中导出状态记录和设置数据。</li>
              <li>你可以删除自己的状态记录、设置、个性化记忆和事件日志。</li>
              <li>你可以关闭长期记忆或取消紧急联系人授权。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. 未成年人和医疗声明</h2>
            <p>
              若你未满当地法律规定的成年年龄，请在监护人指导下使用。若你正处于紧急危险中，请立即拨打当地急救电话
              或联系线下专业人员。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. 联系与更新</h2>
            <p>
              本政策会随产品功能、合规要求和部署环境更新。正式公开发布前，应由法务和临床顾问完成审核。
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
