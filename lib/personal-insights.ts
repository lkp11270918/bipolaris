import type { CheckinData } from "@/components/checkin-screen"
import type { MoodLog } from "@/lib/bipolaris-api"

function average(rows: MoodLog[], key: "sleep" | "energy" | "impulse"): number {
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length
}

export function buildPersonalTrendMessage(checkin: CheckinData, logs: MoodLog[]): string {
  if (logs.length < 3 || checkin.mood <= 0) return ""
  const baseline = logs.slice(1, 8)
  if (baseline.length < 2) return ""
  const signals: string[] = []
  const sleepDelta = checkin.sleep - average(baseline, "sleep")
  const energyDelta = checkin.energy - average(baseline, "energy")
  const impulseDelta = checkin.impulse - average(baseline, "impulse")
  if (sleepDelta <= -1) signals.push("睡眠低于你自己的近期记录")
  if (energyDelta >= 1) signals.push("精力高于你自己的近期记录")
  if (impulseDelta >= 1) signals.push("冲动程度有所升高")
  if (checkin.medication === "missed" || checkin.medication === "partial") signals.push("今天的用药记录出现中断")
  if (!signals.length) return ""
  return `我注意到${signals.join("，")}。这只是记录变化，不代表复发结论；我们可以先留意它是否持续。`
}

export function getRecordingEncouragement(logs: MoodLog[]): string {
  const uniqueDays = Array.from(new Set(logs.map((log) => log.createdAt.slice(0, 10)))).sort().reverse()
  if (!uniqueDays.length) return ""
  let consecutive = 1
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const previous = new Date(`${uniqueDays[index - 1]}T12:00:00`)
    const current = new Date(`${uniqueDays[index]}T12:00:00`)
    if (Math.round((previous.getTime() - current.getTime()) / 86_400_000) !== 1) break
    consecutive += 1
  }
  if (consecutive >= 7) return "你已经留下了一周的连续记录，这会让复诊摘要更有依据；漏记一天也没关系。"
  if (consecutive >= 3) return `你已经连续记录 ${consecutive} 天了；记录是为了少费力地看见变化，不需要追求完美。`
  return ""
}
