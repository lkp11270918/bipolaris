"use client"

import type { CheckinData } from "@/components/checkin-screen"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "https://bipolaris-api.onrender.com"

const ANON_ID_KEY = "bipolaris_anonymous_user_id"
const MOOD_LOG_KEY = "bipolaris_mood_logs"

export type BackendRisk = "low" | "medium" | "crisis"

export interface ChatHistoryMessage {
  role: "user" | "assistant"
  content: string
}

export interface BackendChatResponse {
  reply: string
  risk_level: BackendRisk
  selected_strategy: string
  context_payload: Record<string, unknown>
  used_openai: boolean
}

export interface MoodLog extends CheckinData {
  id: string
  createdAt: string
}

interface BackendMoodLog {
  id: string
  user_id: string
  created_at: string
  mood: number
  sleep: number
  energy: number
  impulse: number
  medication: CheckinData["medication"]
  state: CheckinData["state"]
  notes: string
}

export function getAnonymousUserId(): string {
  if (typeof window === "undefined") return "server"
  const existing = window.localStorage.getItem(ANON_ID_KEY)
  if (existing) return existing
  const id = `anon_${crypto.randomUUID()}`
  window.localStorage.setItem(ANON_ID_KEY, id)
  return id
}

export function checkinToBackendState(checkin: CheckinData) {
  return {
    mood_state: checkin.state === "unknown" ? "stable" : checkin.state,
    sleep: checkin.sleep * 2,
    energy: checkin.energy * 2,
    impulsivity: checkin.impulse * 2,
    medication_schedule:
      checkin.medication === "taken"
        ? ["今日已按医嘱服药"]
        : checkin.medication === "missed"
          ? ["今日可能漏服"]
          : checkin.medication === "partial"
            ? ["今日部分服药"]
            : [],
    completed_routines: [],
    warning_signs: warningSignsFromCheckin(checkin),
    emergency_contact: null,
  }
}

function warningSignsFromCheckin(checkin: CheckinData): string[] {
  const signs: string[] = []
  if (checkin.sleep <= 2 && checkin.energy >= 4) signs.push("睡眠减少但精力充沛")
  if (checkin.impulse >= 4) signs.push("冲动消费或冒险")
  if (checkin.mood <= 2) signs.push("自我评价很低或无望感")
  return signs
}

export async function requestChatReply(
  message: string,
  checkin: CheckinData,
  history: ChatHistoryMessage[],
): Promise<BackendChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      state: checkinToBackendState(checkin),
      history: history.slice(-8),
    }),
  })
  if (!response.ok) throw new Error(`Backend returned ${response.status}`)
  return response.json()
}

export async function submitFeedback(payload: {
  messageId: string
  label: "helpful" | "not_helpful" | "unsafe" | "too_generic" | "medical_boundary" | "other"
  rating?: number
  comment?: string
  riskLevel?: string
  bdState?: string
  selectedStrategy?: string
}) {
  await fetch(`${API_BASE_URL}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_id: `${getAnonymousUserId()}:${payload.messageId}`,
      rating: payload.rating,
      label: payload.label,
      comment: payload.comment,
      risk_level: payload.riskLevel,
      bd_state: payload.bdState,
      selected_strategy: payload.selectedStrategy,
    }),
  })
}

export function saveMoodLog(checkin: CheckinData): MoodLog {
  const logs = getMoodLogs()
  const next: MoodLog = {
    ...checkin,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  window.localStorage.setItem(MOOD_LOG_KEY, JSON.stringify([next, ...logs].slice(0, 30)))
  void syncMoodLog(next).catch(() => {})
  return next
}

export function getMoodLogs(): MoodLog[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(window.localStorage.getItem(MOOD_LOG_KEY) || "[]")
  } catch {
    return []
  }
}

export async function syncMoodLog(log: MoodLog): Promise<void> {
  await fetch(`${API_BASE_URL}/mood-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBackendMoodLog(log)),
  })
}

export async function fetchMoodLogs(limit = 30): Promise<MoodLog[]> {
  const userId = getAnonymousUserId()
  const params = new URLSearchParams({ user_id: userId, limit: String(limit) })
  const response = await fetch(`${API_BASE_URL}/mood-logs?${params.toString()}`)
  if (!response.ok) throw new Error(`Backend returned ${response.status}`)
  const rows = (await response.json()) as BackendMoodLog[]
  const remoteLogs = rows.map(fromBackendMoodLog)
  const merged = mergeMoodLogs(remoteLogs, getMoodLogs()).slice(0, limit)
  window.localStorage.setItem(MOOD_LOG_KEY, JSON.stringify(merged))
  return merged
}

function toBackendMoodLog(log: MoodLog): BackendMoodLog {
  return {
    id: log.id,
    user_id: getAnonymousUserId(),
    created_at: log.createdAt,
    mood: log.mood,
    sleep: log.sleep,
    energy: log.energy,
    impulse: log.impulse,
    medication: log.medication,
    state: log.state,
    notes: log.notes || "",
  }
}

function fromBackendMoodLog(row: BackendMoodLog): MoodLog {
  return {
    id: row.id,
    createdAt: row.created_at,
    mood: row.mood,
    sleep: row.sleep,
    energy: row.energy,
    impulse: row.impulse,
    medication: row.medication,
    state: row.state,
    notes: row.notes || "",
  }
}

function mergeMoodLogs(...groups: MoodLog[][]): MoodLog[] {
  const byId = new Map<string, MoodLog>()
  for (const group of groups) {
    for (const log of group) byId.set(log.id, log)
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
