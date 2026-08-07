"use client"

import type { CheckinData } from "@/components/checkin-screen"
import type { BackendRisk } from "@/lib/bipolaris-api"

const CONVERSATIONS_KEY = "bipolaris_conversations_v1"
const ACTIVE_CONVERSATION_KEY = "bipolaris_active_conversation_id"

export interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  content: string
  risk?: "none" | BackendRisk
  state?: string
  strategy?: string
  ragSources?: string[]
  usedOpenAI?: boolean
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  checkinSnapshot: CheckinData
  messages: ConversationMessage[]
  draft: string
}

export function createConversation(checkin: CheckinData, greeting = ""): Conversation {
  const now = new Date().toISOString()
  const normalizedGreeting = greeting.trim()
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    checkinSnapshot: { ...checkin },
    messages: normalizedGreeting
      ? [
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: normalizedGreeting,
            risk: "none",
            state: checkin.state,
            timestamp: now,
          },
        ]
      : [],
    draft: "",
  }
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(window.localStorage.getItem(CONVERSATIONS_KEY) || "[]") as Conversation[]
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

export function persistConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
}

export function loadActiveConversationId(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY)
}

export function persistActiveConversationId(conversationId: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId)
}

export function clearConversationStorage(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(CONVERSATIONS_KEY)
  window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY)
}

export function deriveConversationTitle(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (!normalized) return "新对话"
  const sentence = normalized.split(/[。！？!?\n]/)[0] || normalized
  return sentence.length > 16 ? `${sentence.slice(0, 16)}…` : sentence
}
