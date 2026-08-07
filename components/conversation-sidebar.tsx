"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react"
import type { Conversation } from "@/lib/conversations"

interface ConversationSidebarProps {
  open: boolean
  conversations: Conversation[]
  activeConversationId: string
  onClose: () => void
  onNewConversation: () => void
  onSelectConversation: (conversationId: string) => void
  onRenameConversation: (conversationId: string, title: string) => void
  onDeleteConversation: (conversationId: string) => void
}

function dateGroup(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.floor((startToday - startValue) / 86_400_000)
  if (days <= 0) return "今天"
  if (days === 1) return "昨天"
  if (days < 7) return "最近 7 天"
  return "更早"
}

export function ConversationSidebar({
  open,
  conversations,
  activeConversationId,
  onClose,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [menuId, setMenuId] = useState<string | null>(null)
  if (!open) return null

  const historyConversations = conversations.filter((conversation) =>
    conversation.messages.some((message) => message.role === "user"),
  )
  const groups = historyConversations.reduce<Record<string, Conversation[]>>((result, conversation) => {
    const group = dateGroup(conversation.updatedAt)
    result[group] = [...(result[group] || []), conversation]
    return result
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/45" onClick={onClose}>
      <div className="w-full max-w-md h-full relative">
        <aside
          className="absolute inset-y-0 left-0 w-[86%] max-w-[340px] bg-card border-r border-border shadow-2xl flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-foreground">BiPolaris</p>
              <p className="text-xs text-muted-foreground mt-0.5">你的对话</p>
            </div>
            <button aria-label="关闭对话侧栏" onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3">
            <button
              onClick={() => {
                onNewConversation()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              新建对话
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-6">
            {historyConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">暂无历史对话</p>
            ) : (
              ["今天", "昨天", "最近 7 天", "更早"].map((group) => {
                const items = groups[group]
                if (!items?.length) return null
                return (
                  <section key={group} className="mb-5">
                    <p className="px-3 mb-2 text-[11px] font-medium text-muted-foreground">{group}</p>
                    <div className="space-y-1">
                      {items.map((conversation) => (
                        <div key={conversation.id} className="relative">
                          <button
                            onClick={() => {
                              onSelectConversation(conversation.id)
                              onClose()
                            }}
                            className={`w-full text-left rounded-xl pl-3 pr-11 py-3 transition-colors ${
                              conversation.id === activeConversationId ? "bg-accent text-accent-foreground" : "hover:bg-muted text-foreground"
                            }`}
                          >
                            <p className="text-sm truncate">{conversation.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {new Date(conversation.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </button>
                          <button
                            aria-label={`管理对话：${conversation.title}`}
                            onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
                            className="absolute right-2 top-2.5 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-background"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuId === conversation.id && (
                            <div className="absolute right-2 top-11 z-10 w-32 rounded-xl border border-border bg-card shadow-lg p-1">
                              <button
                                onClick={() => {
                                  const title = window.prompt("重命名对话", conversation.title)?.trim()
                                  if (title) onRenameConversation(conversation.id, title.slice(0, 30))
                                  setMenuId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted"
                              >
                                <Pencil className="w-3.5 h-3.5" /> 重命名
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`确定删除“${conversation.title}”吗？`)) onDeleteConversation(conversation.id)
                                  setMenuId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-muted"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 删除
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
