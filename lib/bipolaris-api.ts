"use client"

import type { CheckinData } from "@/components/checkin-screen"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "https://bipolaris-api.onrender.com"

const ANON_ID_KEY = "bipolaris_anonymous_user_id"
const MOOD_LOG_KEY = "bipolaris_mood_logs"
const USER_SETTINGS_KEY = "bipolaris_user_settings"

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

export interface UserSettings {
  userId: string
  displayName: string
  ageRange: string
  diagnosisStatus: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  allowEmergencyContactPrompt: boolean
  dailyCheckinEnabled: boolean
  dailyCheckinTime: string
  medicationEnabled: boolean
  medicationTime: string
  appointmentEnabled: boolean
  longTermMemoryEnabled: boolean
  updatedAt: string
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

interface BackendUserSettings {
  user_id: string
  display_name: string
  age_range: string
  diagnosis_status: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relation: string
  allow_emergency_contact_prompt: boolean
  daily_checkin_enabled: boolean
  daily_checkin_time: string
  medication_enabled: boolean
  medication_time: string
  appointment_enabled: boolean
  long_term_memory_enabled: boolean
  updated_at: string
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
  const settings = getUserSettings()
  const hasContact = Boolean(settings.emergencyContactName || settings.emergencyContactPhone)
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
    emergency_contact:
      hasContact && settings.allowEmergencyContactPrompt
        ? {
            name: settings.emergencyContactName || null,
            phone: settings.emergencyContactPhone || null,
          }
        : null,
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

export function getUserSettings(): UserSettings {
  const defaults: UserSettings = {
    userId: getAnonymousUserId(),
    displayName: "",
    ageRange: "",
    diagnosisStatus: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    allowEmergencyContactPrompt: true,
    dailyCheckinEnabled: true,
    dailyCheckinTime: "08:30",
    medicationEnabled: false,
    medicationTime: "21:00",
    appointmentEnabled: true,
    longTermMemoryEnabled: true,
    updatedAt: new Date().toISOString(),
  }
  if (typeof window === "undefined") return defaults
  try {
    return { ...defaults, ...JSON.parse(window.localStorage.getItem(USER_SETTINGS_KEY) || "{}") }
  } catch {
    return defaults
  }
}

export function saveUserSettings(settings: UserSettings): UserSettings {
  const next = { ...settings, userId: getAnonymousUserId(), updatedAt: new Date().toISOString() }
  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(next))
  void syncUserSettings(next).catch(() => {})
  return next
}

export async function fetchUserSettings(): Promise<UserSettings> {
  const userId = getAnonymousUserId()
  const params = new URLSearchParams({ user_id: userId })
  const response = await fetch(`${API_BASE_URL}/user-settings?${params.toString()}`)
  if (!response.ok) throw new Error(`Backend returned ${response.status}`)
  const settings = fromBackendUserSettings((await response.json()) as BackendUserSettings)
  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings))
  return settings
}

export async function syncUserSettings(settings: UserSettings): Promise<void> {
  await fetch(`${API_BASE_URL}/user-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBackendUserSettings(settings)),
  })
}

export async function deleteMyData(): Promise<void> {
  await fetch(`${API_BASE_URL}/delete-user-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: getAnonymousUserId() }),
  })
  window.localStorage.removeItem(MOOD_LOG_KEY)
  window.localStorage.removeItem(USER_SETTINGS_KEY)
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

function toBackendUserSettings(settings: UserSettings): BackendUserSettings {
  return {
    user_id: getAnonymousUserId(),
    display_name: settings.displayName,
    age_range: settings.ageRange,
    diagnosis_status: settings.diagnosisStatus,
    emergency_contact_name: settings.emergencyContactName,
    emergency_contact_phone: settings.emergencyContactPhone,
    emergency_contact_relation: settings.emergencyContactRelation,
    allow_emergency_contact_prompt: settings.allowEmergencyContactPrompt,
    daily_checkin_enabled: settings.dailyCheckinEnabled,
    daily_checkin_time: settings.dailyCheckinTime,
    medication_enabled: settings.medicationEnabled,
    medication_time: settings.medicationTime,
    appointment_enabled: settings.appointmentEnabled,
    long_term_memory_enabled: settings.longTermMemoryEnabled,
    updated_at: settings.updatedAt,
  }
}

function fromBackendUserSettings(row: BackendUserSettings): UserSettings {
  return {
    userId: row.user_id,
    displayName: row.display_name || "",
    ageRange: row.age_range || "",
    diagnosisStatus: row.diagnosis_status || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    emergencyContactRelation: row.emergency_contact_relation || "",
    allowEmergencyContactPrompt: Boolean(row.allow_emergency_contact_prompt),
    dailyCheckinEnabled: Boolean(row.daily_checkin_enabled),
    dailyCheckinTime: row.daily_checkin_time || "08:30",
    medicationEnabled: Boolean(row.medication_enabled),
    medicationTime: row.medication_time || "21:00",
    appointmentEnabled: Boolean(row.appointment_enabled),
    longTermMemoryEnabled: Boolean(row.long_term_memory_enabled),
    updatedAt: row.updated_at || new Date().toISOString(),
  }
}
