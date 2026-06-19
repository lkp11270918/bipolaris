"use client"

import { useState } from "react"
import { BarChart2, MessageCircle, Settings } from "lucide-react"
import { ChatScreen } from "@/components/chat-screen"
import { CheckinScreen, type CheckinData } from "@/components/checkin-screen"
import { ReportScreen } from "@/components/report-screen"
import { SettingsScreen } from "@/components/settings-screen"
import { WelcomeScreen } from "@/components/welcome-screen"
import { saveMoodLog } from "@/lib/bipolaris-api"

type AppPhase = "welcome" | "checkin" | "main"
type MainTab = "chat" | "report" | "settings"

const defaultCheckin: CheckinData = {
  mood: 3,
  sleep: 3,
  energy: 3,
  impulse: 1,
  medication: "taken",
  state: "stable",
  notes: "",
}

export default function Page() {
  const [phase, setPhase] = useState<AppPhase>("welcome")
  const [activeTab, setActiveTab] = useState<MainTab>("chat")
  const [checkinData, setCheckinData] = useState<CheckinData>(defaultCheckin)

  if (phase === "welcome") {
    return (
      <div className="mx-auto max-w-md" style={{ height: "100dvh" }}>
        <WelcomeScreen onComplete={() => setPhase("checkin")} />
      </div>
    )
  }

  if (phase === "checkin") {
    return (
      <div className="mx-auto max-w-md" style={{ height: "100dvh" }}>
        <CheckinScreen
          onComplete={(data) => {
            const nextData = data.state === "unknown" ? { ...data, state: "stable" as const } : data
            setCheckinData(nextData)
            saveMoodLog(nextData)
            setPhase("main")
          }}
        />
      </div>
    )
  }

  const tabs: { key: MainTab; label: string; Icon: typeof MessageCircle }[] = [
    { key: "chat", label: "对话", Icon: MessageCircle },
    { key: "report", label: "记录", Icon: BarChart2 },
    { key: "settings", label: "设置", Icon: Settings },
  ]

  return (
    <div className="mx-auto flex max-w-md flex-col bg-background" style={{ height: "100dvh" }}>
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {activeTab === "chat" && (
          <div className="flex h-full flex-col">
            <ChatScreen checkinData={checkinData} />
          </div>
        )}
        {activeTab === "report" && (
          <div className="h-full overflow-y-auto">
            <ReportScreen />
          </div>
        )}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <SettingsScreen />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-card" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex px-2">
          {tabs.map(({ key, label, Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {isActive && <div className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />}
                <Icon className={`h-5 w-5 transition-all ${isActive ? "scale-110" : ""}`} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
