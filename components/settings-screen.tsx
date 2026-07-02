"use client"

import { useEffect, useState } from "react"
import {
  Bell,
  ChevronRight,
  Database,
  Download,
  Phone,
  Shield,
  Trash2,
  UserCircle,
} from "lucide-react"
import {
  deleteMyData,
  fetchUserSettings,
  getAnonymousUserId,
  getMoodLogs,
  getUserSettings,
  saveUserSettings,
  trackEvent,
  type UserSettings,
} from "@/lib/bipolaris-api"

type Modal = "profile" | "contact" | "privacy" | "delete" | null

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground block mb-1.5">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  )
}

export function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>(() => getUserSettings())
  const [draft, setDraft] = useState<UserSettings>(() => getUserSettings())
  const [modal, setModal] = useState<Modal>(null)
  const [savedHint, setSavedHint] = useState("")

  useEffect(() => {
    void fetchUserSettings()
      .then((remote) => {
        setSettings(remote)
        setDraft(remote)
      })
      .catch(() => {})
  }, [])

  function persist(next: UserSettings, hint = "已保存") {
    const saved = saveUserSettings(next)
    setSettings(saved)
    setDraft(saved)
    setSavedHint(hint)
    window.setTimeout(() => setSavedHint(""), 1800)
  }

  function updateSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    persist({ ...settings, [key]: value })
    trackEvent("setting_toggled", { key: String(key), value })
    if (key === "longTermMemoryEnabled") {
      trackEvent(value ? "long_term_memory_enabled" : "long_term_memory_disabled")
    }
  }

  async function handleDeleteData() {
    await deleteMyData().catch(() => {})
    const reset = getUserSettings()
    setSettings(reset)
    setDraft(reset)
    setModal(null)
    setSavedHint("本机与云端数据已请求删除")
  }

  const displayName = settings.displayName || "匿名用户"
  const contactName = settings.emergencyContactName
  const contactPhone = settings.emergencyContactPhone
  const hasContact = Boolean(contactName || contactPhone)
  const logs = getMoodLogs()

  return (
    <div className="flex flex-col bg-background">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground mb-1">设置</h1>
        <p className="text-sm text-muted-foreground">个人资料与安全设置</p>
      </div>

      <div className="px-5 space-y-5 pb-8">
        <button
          onClick={() => {
            setDraft(settings)
            setModal("profile")
          }}
          className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {settings.ageRange || "未填写年龄段"} · {settings.diagnosisStatus || "未填写状态"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {savedHint && (
          <div className="bg-accent/50 text-accent-foreground rounded-2xl px-4 py-3 text-xs">
            {savedHint}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">紧急联系人</h2>
            <button
              onClick={() => {
                setDraft(settings)
                setModal("contact")
              }}
              className="flex items-center gap-1 text-xs text-primary font-medium"
            >
              {hasContact ? "编辑" : "添加"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            你可以选择添加紧急联系人。只有在系统识别到高风险情况，且你允许提醒时，Bipolaris 才会提示你联系该联系人。
          </p>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
              <Phone className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {hasContact ? contactName || "未填写姓名" : "暂未添加"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {hasContact
                  ? `${settings.emergencyContactRelation || "紧急联系人"} · ${contactPhone || "未填写电话"}`
                  : "Bipolaris 不会在普通对话中自动发送聊天内容"}
              </p>
            </div>
            {hasContact && (
              <button
                onClick={() => {
                  persist({
                    ...settings,
                    emergencyContactName: "",
                    emergencyContactPhone: "",
                    emergencyContactRelation: "",
                  }, "已移除紧急联系人")
                  trackEvent("emergency_contact_removed")
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="mt-2 bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">高风险时提示联系紧急联系人</p>
              <p className="text-xs text-muted-foreground">不会自动向联系人发送对话内容</p>
            </div>
            <Toggle
              checked={settings.allowEmergencyContactPrompt}
              onChange={(checked) => updateSetting("allowEmergencyContactPrompt", checked)}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">提醒设置</h2>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5 gap-3">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">每日签到提醒</p>
                  <input
                    type="time"
                    value={settings.dailyCheckinTime}
                    onChange={(e) => updateSetting("dailyCheckinTime", e.target.value)}
                    className="text-xs text-muted-foreground bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <Toggle
                checked={settings.dailyCheckinEnabled}
                onChange={(checked) => updateSetting("dailyCheckinEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5 gap-3">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">用药提醒</p>
                  <input
                    type="time"
                    value={settings.medicationTime}
                    onChange={(e) => updateSetting("medicationTime", e.target.value)}
                    className="text-xs text-muted-foreground bg-transparent focus:outline-none"
                  />
                </div>
              </div>
              <Toggle
                checked={settings.medicationEnabled}
                onChange={(checked) => updateSetting("medicationEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">复诊前摘要提醒</p>
                  <p className="text-xs text-muted-foreground">复诊前 2 天</p>
                </div>
              </div>
              <Toggle
                checked={settings.appointmentEnabled}
                onChange={(checked) => updateSetting("appointmentEnabled", checked)}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">数据与隐私</h2>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">长期记忆</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.longTermMemoryEnabled ? "开启长期记忆" : "关闭长期记忆"}
                  </p>
                </div>
              </div>
              <Toggle
                checked={settings.longTermMemoryEnabled}
                onChange={(checked) => updateSetting("longTermMemoryEnabled", checked)}
              />
            </div>
            <button
              onClick={() => {
                trackEvent("privacy_policy_viewed", { source: "settings" })
                setModal("privacy")
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">隐私、合规与安全说明</p>
                  <p className="text-xs text-muted-foreground">查看政策、服务边界与数据控制</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => {
                const report = JSON.stringify({ settings, moodLogs: logs }, null, 2)
                const blob = new Blob([report], { type: "application/json" })
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = "bipolaris-data.json"
                link.click()
                URL.revokeObjectURL(url)
                trackEvent("data_exported", { mood_log_count: logs.length })
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-foreground">导出我的数据</p>
                  <p className="text-xs text-muted-foreground">{logs.length} 条状态记录</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setModal("delete")}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-destructive" />
                <div>
                  <p className="text-sm text-destructive">删除我的数据</p>
                  <p className="text-xs text-muted-foreground">永久删除相关记录</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">隐私与安全治理</h2>
          <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              BiPolaris 依据隐私政策和用户协议处理用户数据，采用最小化收集、传输加密、敏感字段加密和访问控制等措施保护情绪健康相关信息。
            </p>
            <p>
              产品设置了医疗边界和心理安全规则：AI 回复不替代诊断、处方、治疗方案或急救服务；识别高风险场景时，会优先引导用户联系危机热线、急救电话或现实支持者。
            </p>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Bipolaris v0.1 · {getAnonymousUserId().slice(0, 13)}
          <br />
          本产品不替代专业医疗诊断与治疗
        </p>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setModal(null)}>
          <div
            className="w-full max-h-[88dvh] overflow-y-auto bg-card rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />

            {modal === "profile" && (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-4">个人信息</h3>
                <div className="space-y-3 mb-6">
                  <Field
                    label="显示昵称"
                    value={draft.displayName}
                    onChange={(value) => setDraft((p) => ({ ...p, displayName: value }))}
                    placeholder="例如：小北"
                  />
                  <Field
                    label="年龄段"
                    value={draft.ageRange}
                    onChange={(value) => setDraft((p) => ({ ...p, ageRange: value }))}
                    placeholder="例如：18-24 / 25-34"
                  />
                  <Field
                    label="当前诊疗状态"
                    value={draft.diagnosisStatus}
                    onChange={(value) => setDraft((p) => ({ ...p, diagnosisStatus: value }))}
                    placeholder="例如：已确诊双相II型 / 正在评估"
                  />
                </div>
                <button
                  onClick={() => {
                    persist(draft, "个人信息已保存")
                    trackEvent("profile_saved", {
                      has_display_name: Boolean(draft.displayName),
                      has_age_range: Boolean(draft.ageRange),
                      has_diagnosis_status: Boolean(draft.diagnosisStatus),
                    })
                    setModal(null)
                  }}
                  className="w-full py-4 rounded-2xl text-base font-medium bg-primary text-primary-foreground active:scale-[0.98]"
                >
                  保存个人信息
                </button>
              </>
            )}

            {modal === "contact" && (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-2">紧急联系人授权</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  你可以选择添加紧急联系人。只有在系统识别到高风险情况，且你允许提醒时，Bipolaris 才会提示你联系该联系人。Bipolaris 不会在普通对话中自动向紧急联系人发送你的聊天内容。
                </p>
                <div className="space-y-3 mb-6">
                  <Field
                    label="姓名"
                    value={draft.emergencyContactName}
                    onChange={(value) => setDraft((p) => ({ ...p, emergencyContactName: value }))}
                    placeholder="联系人姓名"
                  />
                  <Field
                    label="手机号码"
                    value={draft.emergencyContactPhone}
                    onChange={(value) => setDraft((p) => ({ ...p, emergencyContactPhone: value }))}
                    placeholder="联系人电话"
                    type="tel"
                  />
                  <Field
                    label="关系"
                    value={draft.emergencyContactRelation}
                    onChange={(value) => setDraft((p) => ({ ...p, emergencyContactRelation: value }))}
                    placeholder="如：家人、朋友、医生"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 py-4 rounded-2xl text-base font-medium bg-muted text-muted-foreground"
                  >
                    暂不添加
                  </button>
                  <button
                    onClick={() => {
                      persist(draft, "紧急联系人已保存")
                      trackEvent("emergency_contact_added", {
                        has_name: Boolean(draft.emergencyContactName),
                        has_phone: Boolean(draft.emergencyContactPhone),
                        has_relation: Boolean(draft.emergencyContactRelation),
                      })
                      setModal(null)
                    }}
                    disabled={!draft.emergencyContactName && !draft.emergencyContactPhone}
                    className={`flex-1 py-4 rounded-2xl text-base font-medium active:scale-[0.98] ${
                      draft.emergencyContactName || draft.emergencyContactPhone
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    添加紧急联系人
                  </button>
                </div>
              </>
            )}

            {modal === "privacy" && (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-4">隐私、合规与安全说明</h3>
                <div className="space-y-4 text-sm text-foreground leading-relaxed">
                  <div>
                    <h4 className="font-medium mb-1">数据保护措施</h4>
                    <p className="text-xs text-muted-foreground">
                      BiPolaris 会对情绪状态、睡眠与精力记录、风险识别结果、紧急联系人等敏感信息采取传输加密、字段加密、访问控制和日志脱敏等保护措施，降低泄露和未经授权访问的风险。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">最小化收集</h4>
                    <p className="text-xs text-muted-foreground">
                      我们只收集提供陪伴、状态记录、风险识别和安全提醒所必要的信息。与你无关的身份信息不会被主动收集。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">服务条款与用户权利</h4>
                    <p className="text-xs text-muted-foreground">
                      我们通过隐私政策和用户协议说明数据处理方式、服务边界、用户权利和禁止用途。你可以查看记录、导出数据、删除数据、关闭长期记忆或取消紧急联系人授权。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">心理临床安全边界</h4>
                    <p className="text-xs text-muted-foreground">
                      BiPolaris 不提供诊断、处方、剂量调整、治疗方案或急救服务。涉及用药、诊断和治疗，请咨询精神科医生、医生或药师。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">高风险场景处理</h4>
                    <p className="text-xs text-muted-foreground">
                      如果系统识别到自伤、自杀、伤害他人、药物过量或严重失控风险，BiPolaris 会优先提供危机资源和求助建议。除非你主动授权，系统不会在普通对话中自动向紧急联系人发送完整对话内容。
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="w-full mt-6 py-4 rounded-2xl text-base font-medium bg-primary text-primary-foreground"
                >
                  我知道了，继续使用
                </button>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-center text-xs text-primary bg-accent rounded-2xl py-3"
                  >
                    隐私政策
                  </a>
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-center text-xs text-primary bg-accent rounded-2xl py-3"
                  >
                    用户协议
                  </a>
                  <a
                    href="/security"
                    target="_blank"
                    rel="noreferrer"
                    className="text-center text-xs text-primary bg-accent rounded-2xl py-3"
                  >
                    安全说明
                  </a>
                </div>
              </>
            )}

            {modal === "delete" && (
              <>
                <h3 className="text-lg font-semibold text-foreground mb-3">删除我的数据</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  删除后，你的相关对话记录、状态记录和个性化记忆将被清除。删除操作可能无法恢复。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 py-4 rounded-2xl text-base font-medium bg-muted text-muted-foreground"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleDeleteData()}
                    className="flex-1 py-4 rounded-2xl text-base font-medium bg-destructive text-white active:scale-[0.98]"
                  >
                    确认删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
