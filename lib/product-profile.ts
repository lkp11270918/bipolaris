export type SupportGoal =
  | "stability"
  | "warning_signs"
  | "depression_support"
  | "impulse_control"
  | "followup"

export type UserStage = "newly_diagnosed" | "ongoing_care" | "stable_management" | "assessment"

export const supportGoalOptions: Array<{
  value: SupportGoal
  label: string
  description: string
}> = [
  { value: "stability", label: "稳定作息", description: "关注睡眠、精力和日常节律" },
  { value: "warning_signs", label: "关注复发预警", description: "留意和平时不同的状态变化" },
  { value: "depression_support", label: "低落时获得支持", description: "降低行动门槛，先被理解和陪伴" },
  { value: "impulse_control", label: "减少冲动决定", description: "在高能量或烦躁时帮助自己降速" },
  { value: "followup", label: "准备复诊摘要", description: "持续整理状态，复诊时更容易说明" },
]

export const userStageOptions: Array<{ value: UserStage; label: string }> = [
  { value: "ongoing_care", label: "已确诊，规律复诊中" },
  { value: "newly_diagnosed", label: "近期确诊，正在适应" },
  { value: "stable_management", label: "状态较稳定，持续管理" },
  { value: "assessment", label: "正在专业评估中" },
]

export function supportGoalLabel(goal: SupportGoal | string): string {
  return supportGoalOptions.find((item) => item.value === goal)?.label || "日常状态支持"
}
