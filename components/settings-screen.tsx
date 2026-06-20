"use client"

import { useState } from "react"
import { Phone, Plus, Trash2, Bell, Shield, UserCircle, ChevronRight } from "lucide-react"

interface Contact {
  id: string
  name: string
  phone: string
  relation: string
}

export function SettingsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([
    { id: "1", name: "妈妈", phone: "138****1234", relation: "家人" },
  ])
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: "", phone: "", relation: "" })

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      setContacts((prev) => [
        ...prev,
        { id: Date.now().toString(), ...newContact },
      ])
      setNewContact({ name: "", phone: "", relation: "" })
      setShowAddContact(false)
    }
  }

  return (
    <div className="flex flex-col bg-background">
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground mb-1">设置</h1>
        <p className="text-sm text-muted-foreground">个人资料与安全设置</p>
      </div>

      <div className="px-5 space-y-5 pb-8">
        {/* 用户卡片 */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">匿名用户</p>
            <p className="text-xs text-muted-foreground">已连续记录 7 天</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* 紧急联系人 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">紧急联系人</h2>
            <button
              onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1 text-xs text-primary font-medium"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            在危机场景下，Bipolaris 会提醒你联系以下人员。我们不会自动发送消息，联系权由你控制。
          </p>
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.relation} · {c.phone}
                  </p>
                </div>
                <button
                  onClick={() => setContacts((prev) => prev.filter((x) => x.id !== c.id))}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <p className="text-xs text-muted-foreground">暂无紧急联系人</p>
              </div>
            )}
          </div>
        </div>

        {/* 常用热线 */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">危机资源</h2>
          <div className="space-y-2">
            {[
              { name: "希望24热线", number: "400-161-9995", desc: "24小时心理援助热线" },
              { name: "北京心理危机研究与干预中心", number: "010-82951332", desc: "北京地区危机干预" },
              { name: "急救电话", number: "120", desc: "生命危险时立即拨打" },
            ].map((item) => (
              <a
                key={item.number}
                href={`tel:${item.number.replace(/-/g, "")}`}
                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 block active:scale-[0.99] transition-transform"
              >
                <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <p className="text-sm font-medium text-primary">{item.number}</p>
              </a>
            ))}
          </div>
        </div>

        {/* 通知设置 */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">提醒设置</h2>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            {[
              { label: "每日签到提醒", sub: "每天 08:30", enabled: true },
              { label: "用药提醒", sub: "按照设定时间", enabled: false },
              { label: "复诊前摘要提醒", sub: "复诊前 2 天", enabled: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    item.enabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      item.enabled ? "left-6" : "left-1"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 隐私 */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">隐私与数据</h2>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            {[
              { icon: Shield, label: "数据加密说明", sub: "查看我们如何保护你的数据" },
              { icon: Shield, label: "删除我的数据", sub: "永久删除所有记录" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Bipolaris v0.1 · 演示原型
          <br />
          本产品不替代专业医疗诊断与治疗
        </p>
      </div>

      {/* 添加联系人 Modal */}
      {showAddContact && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50"
          onClick={() => setShowAddContact(false)}
        >
          <div
            className="w-full bg-card rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-semibold text-foreground mb-4">添加紧急联系人</h3>
            <div className="space-y-3 mb-6">
              <input
                value={newContact.name}
                onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                placeholder="姓名"
                className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={newContact.phone}
                onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                placeholder="手机号码"
                type="tel"
                className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={newContact.relation}
                onChange={(e) => setNewContact((p) => ({ ...p, relation: e.target.value }))}
                placeholder="关系（如：家人、朋友、医生）"
                className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={addContact}
              disabled={!newContact.name || !newContact.phone}
              className={`w-full py-4 rounded-2xl text-base font-medium transition-all active:scale-[0.98] ${
                newContact.name && newContact.phone
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              添加联系人
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
