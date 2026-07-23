"use client"

import { getUserSettings, trackEvent } from "@/lib/bipolaris-api"
import type { CheckinData } from "@/components/checkin-screen"

const LAST_FIRED_KEY = "bipolaris_last_reminders"

export async function requestReminderPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported"
  const permission = await Notification.requestPermission()
  trackEvent("notification_permission_updated", { permission })
  if (permission === "granted" && "serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js").catch(() => undefined)
  }
  return permission
}

function lastFired(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(LAST_FIRED_KEY) || "{}")
  } catch {
    return {}
  }
}

async function notifyOnce(key: string, title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  const today = new Date().toISOString().slice(0, 10)
  const fired = lastFired()
  if (fired[key] === today) return
  fired[key] = today
  window.localStorage.setItem(LAST_FIRED_KEY, JSON.stringify(fired))
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) await registration.showNotification(title, { body, tag: key })
  else new Notification(title, { body, tag: key })
  trackEvent("reminder_delivered", { reminder_type: key })
}

function isDue(now: Date, time: string, toleranceMinutes = 2): boolean {
  const [hours, minutes] = time.split(":").map(Number)
  const due = new Date(now)
  due.setHours(hours, minutes, 0, 0)
  const delta = now.getTime() - due.getTime()
  return delta >= 0 && delta <= toleranceMinutes * 60_000
}

export function startReminderScheduler(): () => void {
  if (typeof window === "undefined") return () => undefined
  const check = () => {
    const settings = getUserSettings()
    const now = new Date()
    const dailyBody = settings.supportGoals.includes("followup")
      ? "用十秒留下今天的状态，复诊摘要会更完整。"
      : settings.supportGoals.includes("warning_signs")
        ? "用十秒记下睡眠和精力，帮助看见和平时不同的变化。"
        : settings.supportGoals.includes("stability")
          ? "用十秒记下睡眠和作息，继续照顾自己的节律。"
          : "用十秒记下睡眠、精力和情绪变化。"
    if (settings.dailyCheckinEnabled && isDue(now, settings.dailyCheckinTime)) {
      void notifyOnce("daily_checkin", "今天状态怎么样？", dailyBody)
    }
    if (settings.medicationEnabled && isDue(now, settings.medicationTime)) {
      void notifyOnce("medication", "用药记录提醒", "请按医嘱用药，并记录今天的完成情况。")
    }
    if (settings.weeklyReviewEnabled && now.getDay() === settings.weeklyReviewDay && isDue(now, settings.weeklyReviewTime)) {
      void notifyOnce("weekly_review", "本周状态回顾已准备", "看看睡眠、情绪和冲动是否出现了值得关注的变化。")
    }
    if (settings.appointmentEnabled && settings.appointmentDate) {
      const appointment = new Date(`${settings.appointmentDate}T12:00:00`)
      const days = Math.ceil((appointment.getTime() - now.getTime()) / 86_400_000)
      if (days === 2) void notifyOnce("appointment", "距离复诊还有 2 天", "可以检查并导出复诊前状态摘要。")
    }
  }
  check()
  const timer = window.setInterval(check, 60_000)
  return () => window.clearInterval(timer)
}

export function notifySleepSignalIfNeeded(checkin: CheckinData): void {
  if (checkin.sleep > 2 || (checkin.energy < 4 && checkin.impulse < 4)) return
  void notifyOnce(
    "sleep_activation_signal",
    "睡眠与精力出现了组合变化",
    "今天先保护睡眠、降低刺激并延迟重大决定；如果变化持续，请联系复诊医生。",
  )
}
