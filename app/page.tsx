"use client"

import { useEffect, useState } from "react"
import { MessageCircle, BarChart2, Settings } from "lucide-react"
import { WelcomeScreen } from "@/components/welcome-screen"
import { CheckinScreen, type CheckinData } from "@/components/checkin-screen"
import { getGreeting } from "@/components/chat-screen"
import { ChatScreen } from "@/components/chat-screen"
import { ReportScreen } from "@/components/report-screen"
import { SettingsScreen } from "@/components/settings-screen"
import { ConversationSidebar } from "@/components/conversation-sidebar"
import {
  getMoodLogs,
  getUserSettings,
  isOnboardingComplete,
  hasCompletedDailyCheckinToday,
  markOnboardingComplete,
  markDailyCheckinComplete,
  deleteRemoteConversation,
  renameRemoteConversation,
  saveMoodLog,
  saveUserSettings,
  trackEvent,
} from "@/lib/bipolaris-api"
import { notifySleepSignalIfNeeded, startReminderScheduler } from "@/lib/reminders"
import {
  createConversation,
  deriveConversationTitle,
  loadActiveConversationId,
  loadConversations,
  persistActiveConversationId,
  persistConversations,
  type Conversation,
  type ConversationMessage,
} from "@/lib/conversations"

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
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [conversationStoreReady, setConversationStoreReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    trackEvent("app_opened")
    const completed = isOnboardingComplete()
    const checkedInToday = hasCompletedDailyCheckinToday()
    const storedConversations = loadConversations().filter((conversation) =>
      conversation.messages.some((message) => message.role === "user"),
    )
    const storedActiveId = loadActiveConversationId()
    const latestSnapshot =
      storedConversations.find((item) => item.id === storedActiveId)?.checkinSnapshot ||
      storedConversations[0]?.checkinSnapshot ||
      defaultCheckin
    setCheckinData(latestSnapshot)
    if (completed && checkedInToday) {
      const blankConversation = createConversation(latestSnapshot, getGreeting(latestSnapshot))
      setConversations([blankConversation, ...storedConversations])
      setActiveConversationId(blankConversation.id)
    } else {
      setConversations(storedConversations)
      setActiveConversationId("")
    }
    setConversationStoreReady(true)
    setQuickCheckin(completed && getMoodLogs().length > 0)
    setPhase(
      !completed
        ? "welcome"
        : checkedInToday && storedConversations.length > 0
          ? "main"
          : "checkin",
    )
    setInitialized(true)
    return startReminderScheduler()
  }, [])

  useEffect(() => {
    if (!conversationStoreReady) return
    persistConversations(conversations)
  }, [conversations, conversationStoreReady])

  useEffect(() => {
    if (!conversationStoreReady || !activeConversationId) return
    persistActiveConversationId(activeConversationId)
  }, [activeConversationId, conversationStoreReady])

  function startNewConversation(snapshot = checkinData) {
    const conversation = createConversation(snapshot, getGreeting(snapshot))
    setConversations((previous) => [
      conversation,
      ...previous.filter((item) => item.messages.some((message) => message.role === "user")),
    ])
    setActiveConversationId(conversation.id)
    setActiveTab("chat")
    trackEvent("conversation_created")
  }

  function updateConversationMessages(
    conversationId: string,
    updater: (messages: ConversationMessage[]) => ConversationMessage[],
  ) {
    setConversations((previous) => {
      const next = previous.map((conversation) => {
        if (conversation.id !== conversationId) return conversation
        const messages = updater(conversation.messages)
        const firstUserMessage = messages.find((message) => message.role === "user")
        return {
          ...conversation,
          title:
            conversation.title === "新对话" && firstUserMessage
              ? deriveConversationTitle(firstUserMessage.content)
              : conversation.title,
          messages,
          updatedAt: new Date().toISOString(),
        }
      })
      return [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    })
  }

  function updateConversationDraft(conversationId: string, draft: string) {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, draft } : conversation,
      ),
    )
  }

  function renameConversation(conversationId: string, title: string) {
    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title, updatedAt: new Date().toISOString() }
          : conversation,
      ),
    )
    void renameRemoteConversation(conversationId, title).catch(() => {})
    trackEvent("conversation_renamed")
  }

  function deleteConversation(conversationId: string) {
    setConversations((previous) => {
      const remaining = previous.filter((conversation) => conversation.id !== conversationId)
      if (conversationId === activeConversationId) {
        if (remaining[0]) setActiveConversationId(remaining[0].id)
        else {
          const replacement = createConversation(checkinData, getGreeting(checkinData))
          setActiveConversationId(replacement.id)
          return [replacement]
        }
      }
      return remaining
    })
    void deleteRemoteConversation(conversationId).catch(() => {})
    trackEvent("conversation_deleted")
  }

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
            const skipped = data.mood <= 0
            const effectiveData = skipped ? defaultCheckin : data
            setCheckinData(effectiveData)
            markDailyCheckinComplete()
            trackEvent("checkin_completed", {
              mood: data.mood,
              sleep: data.sleep,
              energy: data.energy,
              impulse: data.impulse,
              medication: data.medication,
              state: data.state,
              skipped,
              has_notes: Boolean(data.notes),
            })
            if (data.mood > 0) {
              saveMoodLog(data)
              notifySleepSignalIfNeeded(data)
            }
            trackEvent("chat_started", { source: "checkin_complete", state: data.state })
            // A daily check-in starts a fresh conversation. Previous conversations
            // remain available in the sidebar instead of appearing as new messages.
            const conversation = createConversation(effectiveData, getGreeting(effectiveData))
            setConversations((previous) => [
              conversation,
              ...previous.filter((item) => item.messages.some((message) => message.role === "user")),
            ])
            setActiveConversationId(conversation.id)
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
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0]

  return (
    <div
      className="max-w-md mx-auto flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      {/* 主内容区 — 撑满剩余高度，Chat 内部自己管理 flex 布局 */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className={activeTab === "chat" ? "h-full flex flex-col" : "hidden"}>
          {activeConversation && (
            <ChatScreen
              conversation={activeConversation}
              onUpdateMessages={updateConversationMessages}
              onDraftChange={updateConversationDraft}
              onOpenSidebar={() => setSidebarOpen(true)}
              onNewConversation={() => startNewConversation()}
            />
          )}
        </div>
        <div className={activeTab === "report" ? "h-full overflow-y-auto" : "hidden"}>
          <ReportScreen />
        </div>
        <div className={activeTab === "settings" ? "h-full overflow-y-auto" : "hidden"}>
          <SettingsScreen />
        </div>
      </div>

      <ConversationSidebar
        open={sidebarOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onClose={() => setSidebarOpen(false)}
        onNewConversation={() => startNewConversation()}
        onSelectConversation={(conversationId) => {
          setActiveConversationId(conversationId)
          setActiveTab("chat")
          trackEvent("conversation_opened")
        }}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
      />

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
