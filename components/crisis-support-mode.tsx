"use client"

import { useState } from "react"
import { AlertTriangle, Phone, ShieldCheck, Users, X } from "lucide-react"
import { getUserSettings, trackEvent } from "@/lib/bipolaris-api"
import { crisisResources, telHref } from "@/lib/crisis-resources"

export function CrisisSupportMode({ onReturnToChat }: { onReturnToChat: () => void }) {
  const [safetyConfirmed, setSafetyConfirmed] = useState(false)
  const [aloneStatus, setAloneStatus] = useState<"unknown" | "alone" | "with_someone">("unknown")
  const settings = getUserSettings()
  const contactPhone = settings.allowEmergencyContactPrompt ? settings.emergencyContactPhone : ""
  const hope24 = crisisResources.find((resource) => resource.phone === "400-161-9995")

  return (
    <div className="h-full overflow-y-auto bg-background px-5 py-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs font-medium text-destructive">危机陪伴模式</p>
            <h2 className="text-xl font-semibold text-foreground">先确保此刻的安全</h2>
          </div>
        </div>
        <button onClick={onReturnToChat} aria-label="返回对话" className="w-9 h-9 flex items-center justify-center text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-foreground leading-relaxed mb-5">
        我很在意你现在的安全。请先离开楼顶、道路、窗边等危险位置，把药物、刀具或其他可能造成伤害的物品放远，走到有人能看见你的地方。
      </p>

      <div className="space-y-3 mb-5">
        <button
          onClick={() => {
            setSafetyConfirmed(true)
            trackEvent("crisis_safety_step_confirmed", { step: "moved_to_safety" })
          }}
          className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 ${safetyConfirmed ? "bg-green-50 border-green-300" : "bg-card border-border"}`}
        >
          <ShieldCheck className={`w-5 h-5 ${safetyConfirmed ? "text-green-600" : "text-muted-foreground"}`} />
          <div><p className="text-sm font-medium">我已经移动到更安全的地方</p><p className="text-xs text-muted-foreground mt-0.5">远离边缘、交通和可能造成伤害的物品</p></div>
        </button>
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div><p className="text-sm font-medium">你现在是否独处？</p><p className="text-xs text-muted-foreground mt-0.5">尽量让现实中的人来到你身边</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setAloneStatus("with_someone")
                trackEvent("crisis_safety_step_confirmed", { step: "not_alone" })
              }}
              className={`py-3 rounded-xl border text-xs font-medium ${aloneStatus === "with_someone" ? "bg-green-50 border-green-300 text-green-700" : "border-border text-foreground"}`}
            >我现在有人陪着</button>
            <button
              onClick={() => {
                setAloneStatus("alone")
                trackEvent("crisis_safety_step_confirmed", { step: "still_alone" })
              }}
              className={`py-3 rounded-xl border text-xs font-medium ${aloneStatus === "alone" ? "bg-amber-50 border-amber-300 text-amber-800" : "border-border text-foreground"}`}
            >我现在仍然独处</button>
          </div>
          {aloneStatus === "alone" && (
            <p className="text-xs text-amber-800 leading-relaxed mt-3">请现在拨打下面的电话，或联系紧急联系人，让对方来到你身边并陪你等待专业帮助。</p>
          )}
        </div>
      </div>

      <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 mb-4">
        <p className="text-sm font-medium text-foreground mb-3">现在获得现实帮助</p>
        <div className="space-y-2">
          <a href="tel:120" onClick={() => trackEvent("hotline_clicked", { hotline: "120", source: "crisis_mode" })} className="h-12 rounded-xl bg-destructive text-white flex items-center justify-center gap-2 text-sm font-medium">
            <Phone className="w-4 h-4" /> 拨打急救电话 120
          </a>
          {hope24 && [hope24].map((resource) => (
            <a key={resource.id} href={telHref(resource.phone)} onClick={() => trackEvent("hotline_clicked", { hotline: resource.id, source: "crisis_mode" })} className="h-12 rounded-xl bg-card border border-destructive/30 text-destructive flex items-center justify-center gap-2 text-sm font-medium">
              <Phone className="w-4 h-4" /> {resource.name} {resource.phone}
            </a>
          ))}
          {contactPhone && (
            <a href={telHref(contactPhone)} onClick={() => trackEvent("emergency_contact_called", { source: "crisis_mode" })} className="h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4" /> 联系{settings.emergencyContactName || "紧急联系人"}
            </a>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed text-center">
        BiPolaris 不能代替急救服务。若你可能马上行动，请优先拨打 120。
      </p>
    </div>
  )
}
