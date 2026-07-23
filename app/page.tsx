"use client"

import { useEffect, useState } from "react"
import { MessageCircle, BarChart2, Settings } from "lucide-react"
import { WelcomeScreen } from "@/components/welcome-screen"
import { CheckinScreen, type CheckinData } from "@/components/checkin-screen"
import { ChatScreen } from "@/components/chat-screen"
import { ReportScreen } from "@/components/report-screen"
import { SettingsScreen } from "@/components/settings-screen"
import {
  getMoodLogs,
  getUserSettings,
  isOnboardingComplete,
  markOnboardingComplete,
  saveMoodLog,
  saveUserSettings,
  trackEvent,
} from "@/lib/bipolaris-api"
import { notifySleepSignalIfNeeded, startReminderScheduler } from "@/lib/reminders"

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
  const [initialized, setInitialized] = useState(false)
  const [quickCheckin, setQuickCheckin] = useState(false)
  const [activeTab, setActiveTab] = useState<MainTab>("chat")
  const [checkinData, setCheckinData] = useState<CheckinData>(defaultCheckin)

  useEffect(() => {
    trackEvent("app_opened")
    const completed = isOnboardingComplete()
    setQuickCheckin(completed && getMoodLogs().length > 0)
    setPhase(completed ? "checkin" : "welcome")
    setInitialized(true)
    return startReminderScheduler()
  }, [])

  if (!initialized) return <div className="h-[100dvh] bg-background" />

  if (phase === "welcome") {
    return (
      <div className="max-w-md mx-auto" style={{ height: "100dvh" }}>
        <WelcomeScreen
          onComplete={({ supportGoals, userStage }) => {
            saveUserSettings({ ...getUserSettings(), supportGoals, userStage })
            markOnboardingComplete()
            trackEvent("privacy_notice_confirmed")
            trackEvent("onboarding_goals_saved", { support_goals: supportGoals, user_stage: userStage })
            setQuickCheckin(false)
            setPhase("checkin")
          }}
        />
      </div>
    )
  }

  if (phase === "checkin") {
    return (
      <div className="max-w-md mx-auto" style={{ height: "100dvh" }}>
        <CheckinScreen
          quick={quickCheckin}
          onComplete={(data) => {
            setCheckinData(data)
            trackEvent("checkin_completed", {
              mood: data.mood,
              sleep: data.sleep,
              energy: data.energy,
              impulse: data.impulse,
              medication: data.medication,
              state: data.state,
              skipped: data.mood <= 0,
              has_notes: Boolean(data.notes),
            })
            if (data.mood > 0) {
              saveMoodLog(data)
              notifySleepSignalIfNeeded(data)
            }
            trackEvent("chat_started", { source: "checkin_complete", state: data.state })
            setPhase("main")
          }}
          onUseFullCheckin={() => setQuickCheckin(false)}
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
    <div
      className="max-w-md mx-auto flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      {/* 主内容区 — 撑满剩余高度，Chat 内部自己管理 flex 布局 */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
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

      {/* 底部导航 */}
      <div className="shrink-0 bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex px-2">
          {tabs.map(({ key, label, Icon }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key)
                  trackEvent(`${key}_tab_viewed`)
                }}
                className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors relative ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
                <Icon className={`w-5 h-5 transition-all ${isActive ? "scale-110" : ""}`} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
